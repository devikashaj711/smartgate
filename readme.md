
# SmartGate: Secure Face Recognition System

This repository contains the code for SmartGate, a secure and efficient face recognition system for managing employee and visitor attendance. The system is built using Flask for the backend and plain HTML, CSS, and JavaScript for the frontend.

---

## Table of Contents

1. [Requirements](#requirements)
2. [Folder Structure](#folder-structure)
3. [Installation](#installation)
4. [Running the Application](#running-the-application)
   - [Backend (Flask)](#backend-flask)
   - [Frontend (UI)](#frontend-ui)
5. [Deployment Instructions](#deployment-instructions)
   - [Configuring Nginx for Deployment](#configuring-nginx-for-deployment)
6. [License](#license)

---

## Requirements

Before running the application, ensure the following dependencies are installed:

- **Python 3.8+**
- **Pip (Python Package Manager)**
- **Git**
- **Nginx**
- **Web Browser (e.g., Chrome, Firefox)**

---

## Folder Structure

```
smartgate/
├── flask-app/             # Backend API built with Flask
│   ├── app.py             # Main Flask application file
│   ├── requirements.txt   # Python dependencies
├── ui/                    # Frontend files
│   ├── index.html         # Main UI page
│   ├── styles.css         # Stylesheet for the frontend
│   ├── script.js          # JavaScript logic
├── .gitignore             # Git ignore file
└── README.md              # Documentation
```

---

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/your-repo.git
cd smartgate
```

### 2. Set Up the Backend
1. Navigate to the `flask-app` directory:
   ```bash
   cd flask-app
   ```

2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## Running the Application

### Backend (Flask)
1. Start the Flask server:
   ```bash
   python app.py
   ```

2. The backend API will be accessible at `http://127.0.0.1:5000`.

### Frontend (UI)
1. Navigate to the `ui` folder:
   ```bash
   cd ../ui
   ```

2. Open `index.html` in your preferred web browser:
   - Example:
     ```bash
     open index.html  # MacOS
     xdg-open index.html  # Linux
     start index.html  # Windows
     ```

3. The UI interacts with the Flask backend running at `http://127.0.0.1:5000`.

---

## Deployment Instructions

### Deploying the Backend on a Server (AWS EC2 Example)
1. SSH into your EC2 instance:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-public-ip
   ```

2. Install Python and required dependencies:
   ```bash
   sudo apt update
   sudo apt install python3 python3-pip python3-venv -y
   ```

3. Clone the repository and set up the backend:
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd smartgate/flask-app
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```

4. Configure your EC2 instance security group to allow HTTP traffic on port 5000.

---

### Configuring Nginx for Deployment

#### Install Nginx
```bash
sudo apt update
sudo apt install nginx -y
```

#### Configure Nginx for Backend and Frontend
1. Create an Nginx configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/smartgate
   ```

2. Add the following configuration:
   ```
   server {
       listen 80;
       server_name your-server-ip;

       # Frontend configuration
       location / {
           root /path/to/ui;
           index index.html;
       }

       # Backend configuration
       location /api/ {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

3. Enable the configuration:
   ```bash
   sudo ln -s /etc/nginx/sites-available/smartgate /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

#### Host the Frontend
1. Copy the `ui` folder to the specified `/path/to/ui` directory.
   ```bash
   sudo cp -r ../ui /var/www/smartgate
   ```

2. Restart Nginx to apply changes:
   ```bash
   sudo systemctl restart nginx
   ```

3. Access the application via the server's IP address.

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.
