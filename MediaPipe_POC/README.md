# MediaPipe POC — Getting Started

This POC demonstrates an extension-less AI proctoring system using MediaPipe.

## 1. Prerequisites
- **Node.js**: v18+ 
- **Python**: 3.9+
- **MongoDB**: Running locally at `mongodb://localhost:27017`

## 2. Run the Backend
```bash
cd MediaPipe_POC/backend
# (Optional) Create a virtual environment
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
The backend will run on `http://localhost:8000`.

## 3. Run the Frontend
```bash
cd MediaPipe_POC/frontend
npm install  # (Already done if you are following the agent steps)
npm run dev
```
Open the provided Local URL in Chrome or Edge.

## 4. Testing the Proctor
1. Allow Camera permissions.
2. **Face Tracking**: Watch the "Neural Proctor" dashboard update as you move your head.
3. **Yaw Detection**: Turn your head significantly to the left or right. The status should change to "Looking Away (Yaw)".
4. **Gaze Detection**: Look significantly to the corners of your eyes without moving your head. The status should change to "Suspicious Eye Movement".
5. **Backend Sync**: Check the terminal logs of the backend to see violation logs being submitted.
