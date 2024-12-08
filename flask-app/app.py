from flask import Flask, request, jsonify
import os
import base64
import boto3 # type: ignore
from flask_cors import CORS # type: ignore
from io import BytesIO
from datetime import datetime
import uuid
from operator import itemgetter

session = boto3.Session()
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

app = Flask(__name__)
CORS(app)

# AWS Configuration
S3_BUCKET = "my-first-face-recognition-bucket"

# Initialize rekognition, S3 and DynamoDB clients
rekognition = boto3.client('rekognition', region_name='us-east-1')
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

table = dynamodb.Table('registration-details')
visitor_table = dynamodb.Table('smartgate-visitors')


def save_visitor(visitor_id, image_data, face_id=None, details=None, attendance=None):
    """
    Save visitor details to the visitor-table.
    
    visitor_id: Unique ID for the visitor.
    image_data: Base64 encoded image data or S3 URL.
    face_id: Face ID from Rekognition, if found.
    details: Dictionary with matched person details (EmployeeId, FirstName, LastName, ContactNumber).
    attendance: Attendance status, e.g., "marked" for registered users.
    """
    item = {
        "VisitorId": visitor_id,
        "FaceId": face_id,
        "ImageData": image_data,
        "Timestamp": datetime.utcnow().isoformat(),
        "EmployeeId": details.get('EmployeeId') if details else None,
        "FirstName": details.get('FirstName') if details else None,
        "LastName": details.get('LastName') if details else None,
        "ContactNumber": details.get('ContactNumber') if details else None,
        "Attendance": attendance,
    }
    visitor_table.put_item(Item=item)

@app.route('/submit', methods=['POST'])
def submit_form():
    """
    Submit registration form
    """
    try:
        data = request.get_json()
        employee_id = data.get('employeeId')
        image_data = data.get('image')

        # Check if employee_id already exists in DynamoDB
        existing_item = table.get_item(Key={'EmployeeId': employee_id})
        if 'Item' in existing_item:
            return jsonify({"error": "Unable to submit the form. Employee ID already exists."}), 400

        # Decode base64 image
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        image = BytesIO(image_bytes)

        # Check for duplicate face using Rekognition
        try:
            search_response = rekognition.search_faces_by_image(
                CollectionId="my-face-collection",
                Image={'Bytes': image_bytes},
                MaxFaces=1
            )
            if search_response.get('FaceMatches'):
                return jsonify({"error": "Unable to submit the form. Face already registered."}), 400
        except:
            return jsonify({"error": f"Error checking for duplicate face: "}), 500

        #Upload to S3
        filename = f"registration/{employee_id}.jpg"
        s3_client.upload_fileobj(image, S3_BUCKET, filename)

        #Add face to Rekognition collection
        response = rekognition.index_faces(
            CollectionId="my-face-collection",
            Image={'S3Object': {'Bucket': S3_BUCKET, 'Name': filename}},
            ExternalImageId=employee_id,
            DetectionAttributes=['DEFAULT']
        )

        if response['FaceRecords']:
            face_id = response['FaceRecords'][0]['Face']['FaceId']

            #Save to DynamoDB with Rekognition token
            table.put_item(
                Item={
                    'EmployeeId': employee_id,
                    'FirstName': data['firstName'],
                    'LastName': data['lastName'],
                    'ContactNumber': data['contactNumber'],
                    'ImageId': filename,
                    'FaceId': face_id  #Rekognition face token
                }
            )
            return jsonify({"message": "Form details and image saved successfully!", "FaceId": face_id}), 200
        else:
            return jsonify({"error": "Unable to add face to Rekognition collection."}), 500
    except:
        return jsonify({"error": "Sorry, something went wrong"}), 500


@app.route('/employees', methods=['GET'])
def get_employees():
    """
    To get employee details
    """
    response = table.scan()
    employees = response.get('Items', [])
    return jsonify(employees), 200



@app.route('/search-face', methods=['POST'])
def search_face():
    """
    To search face in real time
    """
    try:
        data = request.get_json()
        image_data = data.get('image')

        # Decode base64 image
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        image = BytesIO(image_bytes)

        # Unique ID for the visitor
        visitor_id = str(uuid.uuid4())[:8]

        # Search for matching faces in the collection
        try:
            response = rekognition.search_faces_by_image(
                CollectionId="my-face-collection",
                Image={'Bytes': image.read()},
                MaxFaces=5
            )
        except Exception as e:
            return jsonify({"message": "Error searching for faces", "error": str(e)}), 500
        
        # Handle multiple faces detected
        if len(response.get('FaceMatches', [])) > 1:
            return jsonify({"message": "Multiple faces detected"}), 400

        if response.get('FaceMatches'):
            face_id = response['FaceMatches'][0]['Face']['FaceId']

            # Query DynamoDB for matching details
            result = table.scan(
                FilterExpression="FaceId = :face_id",
                ExpressionAttributeValues={":face_id": face_id}
            )

            if result.get('Items'):
                matched_person = result['Items'][0]
                
                # Save visitor details
                save_visitor(visitor_id, image_data, face_id, {
                    "EmployeeId": matched_person['EmployeeId'],
                    "FirstName": matched_person['FirstName'],
                    "LastName": matched_person['LastName'],
                    "ContactNumber": matched_person['ContactNumber'],
                }, attendance="marked")

                return jsonify({
                    "message": "Face match found!",
                    "details": {
                        "EmployeeId": matched_person['EmployeeId'],
                        "FirstName": matched_person['FirstName'],
                        "LastName": matched_person['LastName'],
                        "ContactNumber": matched_person['ContactNumber'],
                    }
                }), 200
            else:
                # Save visitor details without registration info
                save_visitor(visitor_id, image_data, face_id, attendance="not marked")

                return jsonify({"message": "Face match found, but no details in database."}), 404
        else:
            # Save unmatched visitor image
            save_visitor(visitor_id, image_data, attendance="not marked")

            return jsonify({"message": "No matching faces found."}), 200
    except: 
        return jsonify({"message": "Sorry, something went wrong"}), 500
    
@app.route('/visitors', methods=['GET'])
def get_visitors():
    """
    Scan the DynamoDB table to get all visitor data
    """
    response = visitor_table.scan()
    visitors = response.get('Items', [])
    # Include ImageData (Base64 or URL) in the response
    for visitor in visitors:
        # Ensure ImageData is present
       if 'ImageData' in visitor and visitor['ImageData']:
            visitor['ImageData'] = f"data:image/jpeg;base64,{visitor['ImageData']}"  # Assuming JPEG images
    # Sort visitors by Timestamp (descending)
    visitors = sorted(visitors, key=itemgetter('Timestamp'), reverse=True)
    for visitor in visitors:
       if 'Timestamp' in visitor:
                # Parse the existing timestamp and reformat it
                original_timestamp = datetime.fromisoformat(visitor['Timestamp'])
                visitor['Timestamp'] = original_timestamp.strftime('%H:%M:%S %m:%d:%Y')
        
    return jsonify(visitors), 200

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=4999)
