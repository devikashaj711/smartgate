const video = document.createElement('video'); // Hidden video element
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const capturedCanvas = document.getElementById('captured-frame');
const capturedCtx = capturedCanvas.getContext('2d');

let src = null;
let gray = null;
let faceDetectionCooldown = false; // Prevent multiple detections within cooldown period

/* Face detection algorithm */
async function loadCascade() {
    const haarCascadeUrl =
        'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml';
    const haarCascadeFileName = 'haarcascade_frontalface_default.xml';

    try {
        const response = await fetch(haarCascadeUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Haar Cascade: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        cv.FS_createDataFile('/', haarCascadeFileName, uint8Array, true, false, false);

        console.log('Haar Cascade loaded successfully.');
        return haarCascadeFileName;
    } catch (error) {
        console.error('Error loading Haar Cascade:', error);
        throw error;
    }
}

/* To start camera for capturing face */
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();

            // Set canvas dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            capturedCanvas.width = 320; // Fixed size for captured frame
            capturedCanvas.height = 240;

            // Initialize OpenCV Mats
            src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
            gray = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC1);

            console.log(`Initialized Mats with dimensions: src(${src.rows}x${src.cols}), gray(${gray.rows}x${gray.cols})`);

            // Load Haar Cascade and start detection
            loadCascade().then((cascadeFileName) => {
                detectFaces(cascadeFileName);
            });
        };
    } catch (error) {
        console.error('Error accessing the camera:', error);
    }
}

/* Capture photo for registration */
function manualFrameCapture(video, src) {
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = video.videoWidth;
    hiddenCanvas.height = video.videoHeight;
    const hiddenCtx = hiddenCanvas.getContext('2d');

    // Copy the video frame to the hidden canvas
    hiddenCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    // Read the canvas data into the src matrix
    const imageData = hiddenCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
    src.data.set(imageData.data);
}

/* For sending captured image to backened */
async function sendToFlask(base64Image) {
    const resultContainer = document.getElementById('match-result');
    try {
        const response = await fetch('http://localhost:4999/search-face', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64Image }),
        });

        const result = await response.json();
        console.log('Response from Flask:', result);

        // Update the result container based on the response
        if (result.message === 'Face match found!') {
            resultContainer.innerHTML = `Hi ${result.details.FirstName}!<br><br> Your attendance has been marked`;
            resultContainer.style.color = 'green'; // Success color
        } else if (result.message === 'No matching faces found.') {
            resultContainer.innerHTML = `Hello! <br><br> We can't find you in our system <br> Please contact Helpdesk`;
            resultContainer.style.color = 'red'; // Failure color
        } else if (result.message === 'Multiple faces detected') {
            resultContainer.innerHTML = `Warning! <br><br> Multiple faces detected. <br> Please ensure only one face is visible.`;
            resultContainer.style.color = 'orange'; // Warning message
        }
    } catch (error) {
        console.error('Error sending face to Flask:', error);
        resultContainer.textContent = 'An error occurred. Please try again.';
        resultContainer.style.color = 'red'; // Error color
    }
}

/* Draw corners for face detection */
function drawCorners(ctx, face, cornerLength = 20, lineWidth = 4, color = 'white') {
    const { x, y, width, height } = face;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLength);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLength, y);
    ctx.stroke();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(x + width - cornerLength, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerLength);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(x + width, y + height - cornerLength);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width - cornerLength, y + height);
    ctx.stroke();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(x + cornerLength, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + height - cornerLength);
    ctx.stroke();
}

/* For detecting faces in real time */
function detectFaces(cascadeFileName) {
    const faceCascade = new cv.CascadeClassifier();
    faceCascade.load(cascadeFileName);

    setInterval(() => {
        try {
            if (!src || !gray) {
                console.error('Mats are not initialized.');
                return;
            }

            // Capture the video frame
            manualFrameCapture(video, src);

            // Convert the frame to grayscale
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            const faces = new cv.RectVector();
            const minSize = new cv.Size(30, 30);

            // Detect faces
            faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, minSize);

            // Draw the video frame and detection overlays
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            for (let i = 0; i < faces.size(); i++) {
                const face = faces.get(i);

                // Skip faces smaller than 150px in height
                if (face.height < 150) {
                    console.log(`Skipped face at (${face.x}, ${face.y}) due to small height: ${face.height}px`);
                    continue;
                }

                // Draw corners around the detected face
                drawCorners(ctx, face);

                if (!faceDetectionCooldown) {
                    // Add padding around the detected face
                    const padding = 0.2; // 20% padding
                    const padX = face.width * padding;
                    const padY = face.height * padding;

                    const cropX = Math.max(0, face.x - padX);
                    const cropY = Math.max(0, face.y - padY);
                    const cropWidth = Math.min(video.videoWidth - cropX, face.width + 2 * padX);
                    const cropHeight = Math.min(video.videoHeight - cropY, face.height + 2 * padY);

                    // Capture the detected face with padding
                    capturedCtx.clearRect(0, 0, capturedCanvas.width, capturedCanvas.height);
                    capturedCtx.drawImage(
                        video,
                        cropX,
                        cropY,
                        cropWidth,
                        cropHeight,
                        0,
                        0,
                        capturedCanvas.width,
                        capturedCanvas.height
                    );

                    console.log(`Face detected at (${face.x}, ${face.y}), size: ${face.width}x${face.height}`);

                    // Get the captured frame as a Base64 string
                    const base64Image = capturedCanvas.toDataURL('image/jpeg');

                    // Send the Base64 image to Flask
                    sendToFlask(base64Image);

                    // Apply a 10-second cooldown
                    faceDetectionCooldown = true;
                    setTimeout(() => {
                        faceDetectionCooldown = false;
                        console.log('Cooldown ended, ready to detect next face.');
                    }, 10000);

                    // Break after capturing the first valid face
                    break;
                }
            }

            faces.delete();
        } catch (err) {
            console.error('Error during face detection:', err);
        }
    }, 100); // Run detection every 100ms
}

window.onload = () => {
    cv['onRuntimeInitialized'] = () => {
        console.log('OpenCV.js is ready.');
        startCamera();
    };
};
