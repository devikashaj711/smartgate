const video = document.getElementById('camera');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
let stream = null;

/* To open camera */
function openCamera() {
    if (!stream) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(localStream => {
                stream = localStream;
                video.srcObject = stream;
                video.addEventListener('loadedmetadata', () => {
                    const aspectRatio = video.videoWidth / video.videoHeight;
                    video.width = 200;
                    video.height = 200 / aspectRatio;
                    canvas.width = video.width;
                    canvas.height = video.height;
                    video.style.display = 'block';
                    canvas.style.display = 'none';
                });
            })
            .catch(error => {
                console.error("Error accessing camera: ", error);
                alert("Could not access camera. Please allow camera access.");
            });
    } else {
        video.style.display = 'block';
        canvas.style.display = 'none';
    }
}

/* To capture image */
function captureImage() {
    if (!stream) {
        openCamera();
    } else {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        video.style.display = 'none';
        canvas.style.display = 'block';
    }
}

/* To stop camera access */
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

/* To retake image */
function retakeImage() {
    video.style.display = 'block';
    canvas.style.display = 'none';
}

/* To submit form */
function submitForm(event) {
    event.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const employeeId = document.getElementById('employeeId').value.trim();
    const contactNumber = document.getElementById('contactNumber').value.trim();

    // Validate form fields
    if (!firstName || !lastName || !employeeId || !contactNumber) {
        alert("Please fill in all the fields before submitting.");
        return;
    }

    const imageData = canvas.toDataURL('image/png'); // Convert canvas to Base64 string

    const formData = {
        firstName: firstName,
        lastName: lastName,
        employeeId: employeeId,
        contactNumber: contactNumber,
        image: imageData
    };

    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = '';
    messageBox.style.color = '';

    fetch('http://54.86.150.4:4999/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
        .then(response => {
            if (response.status === 200) {
                return response.json().then(data => {
                    console.log('Success:', data);
                    messageBox.textContent = 'Form submitted successfully!';
                    messageBox.style.color = 'green';
                    stopCamera();
                });
            } else if (response.status === 400) {
                return response.json().then(data => {
                    console.error('Error:', data);
                    messageBox.innerHTML = data.error || 'Unable to submit the form. <br> Employee ID or face already exists.';
                    messageBox.style.color = 'red';
                });
            } else {
                throw new Error('Unexpected response status: ' + response.status);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            messageBox.textContent = 'There was an error submitting the form.';
            messageBox.style.color = 'red';
        });
}
