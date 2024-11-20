const video = document.createElement('video'); // Hidden video element
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const capturedCanvas = document.getElementById('captured-frame');
const capturedCtx = capturedCanvas.getContext('2d');

let src = null;
let gray = null;
let faceDetectionCooldown = false; // Prevent multiple detections within cooldown period

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

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();

            // Set canvas dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            capturedCanvas.width = 320; // Set for captured frame
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

                if (!faceDetectionCooldown) {
                    // Capture the first detected face
                    capturedCtx.clearRect(0, 0, capturedCanvas.width, capturedCanvas.height);
                    capturedCtx.drawImage(
                        video,
                        face.x,
                        face.y,
                        face.width,
                        face.height,
                        0,
                        0,
                        capturedCanvas.width,
                        capturedCanvas.height
                    );

                    console.log(`Face detected at (${face.x}, ${face.y}), size: ${face.width}x${face.height}`);

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
