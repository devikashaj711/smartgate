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

    response = table.put_item(
        Item={
            'EmployeeId': data['employeeId'],
            'FirstName': data['firstName'],
            'LastName': data['lastName'],
            'ContactNumber': data['contactNumber'],
            'ImageId': data['image']
        }
    )
    image_data = data.get('image')  # Base64 encoded image string

    if image_data:
       
        if "," in image_data:
            image_data = image_data.split(",")[1]
        # Decode base64 image data
        image_bytes = base64.b64decode(image_data)
        image = BytesIO(image_bytes)

        filename = f"registration/{employee_id}.jpg"

        # Upload the file to S3
        s3_client.upload_fileobj(
            image,
            S3_BUCKET,
            filename
        )

    return jsonify({"message": "Form details and image saved successfully!"}), 200


@app.route('/employees', methods=['GET'])
def get_employees():
    response = table.scan()
    employees = response.get('Items', [])
    return jsonify(employees), 200




if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=4999)
