from flask import Flask, request, jsonify
import os
import base64
import boto3 # type: ignore
from flask_cors import CORS # type: ignore
from io import BytesIO

session = boto3.Session()
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
print(session.get_credentials().get_frozen_credentials())

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = 'uploads'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# AWS Configuration
S3_BUCKET = "my-first-face-recognition-bucket"

# Initialize S3 and DynamoDB clients
rekognition = boto3.client('rekognition', region_name='us-east-1')

s3_client = boto3.client(
    's3'
)
dynamodb = boto3.resource(
    'dynamodb'
)

table = dynamodb.Table('registration-details')


@app.route('/submit', methods=['POST'])
def submit_form():
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

    # Upload to S3
    filename = f"registration/{employee_id}.jpg"
    s3_client.upload_fileobj(image, S3_BUCKET, filename)

    # Add face to Rekognition collection
    response = rekognition.index_faces(
        CollectionId="my-face-collection",
        Image={'S3Object': {'Bucket': S3_BUCKET, 'Name': filename}},
        ExternalImageId=employee_id,
        DetectionAttributes=['DEFAULT']
    )

    if response['FaceRecords']:
        face_id = response['FaceRecords'][0]['Face']['FaceId']

        # Save to DynamoDB with Rekognition token
        table.put_item(
            Item={
                'EmployeeId': employee_id,
                'FirstName': data['firstName'],
                'LastName': data['lastName'],
                'ContactNumber': data['contactNumber'],
                'ImageId': filename,
                'FaceId': face_id  # Rekognition face token
            }
        )
        return jsonify({"message": "Form details and image saved successfully!", "FaceId": face_id}), 200
    else:
        return jsonify({"error": "Unable to add face to Rekognition collection."}), 500


@app.route('/employees', methods=['GET'])
def get_employees():
    response = table.scan()
    employees = response.get('Items', [])
    return jsonify(employees), 200

@app.route('/search-face', methods=['POST'])
def search_face():
    data = request.get_json()
    image_data = data.get('image')

    # Decode base64 image
    if "," in image_data:
        image_data = image_data.split(",")[1]
    image_bytes = base64.b64decode(image_data)
    image = BytesIO(image_bytes)

    # Search for matching faces in the collection
    response = rekognition.search_faces_by_image(
        CollectionId="my-face-collection",
        Image={'Bytes': image.read()},
        MaxFaces=1
    )

    if response['FaceMatches']:
        face_id = response['FaceMatches'][0]['Face']['FaceId']

        # Query DynamoDB for matching details
        result = table.scan(
            FilterExpression="FaceId = :face_id",
            ExpressionAttributeValues={":face_id": face_id}
        )
        if result['Items']:
            matched_person = result['Items'][0]
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
            return jsonify({"message": "Face match found, but no details in database."}), 404
    else:
        return jsonify({"message": "No matching faces found."}), 200



if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=4999)
