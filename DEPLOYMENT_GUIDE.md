# HyrAI Deployment & Handover Guide
## One-Click Production Deployment

This guide is designed for the platform administrator/manager to deploy the **HyrAI Proctoring Platform** in a production environment using Docker.

---

## 🏗️ Prerequisites
Ensure the target server has the following installed:
1. **Docker** (v20.10+)
2. **Docker Compose** (v2.0+)

---

## 🚀 One-Click Deployment

To launch the entire stack (Database, Backend, and Frontend), follow these steps:

1. **Clone/Download** the project repository to the server.
2. **Open a Terminal** in the root directory of the project.
3. **Run the launch command:**
   ```bash
   docker-compose up -d --build
   ```
4. **Verification**:
   - **Frontend**: Accessible at `http://your-server-ip`
   - **Backend API**: Accessible at `http://your-server-ip:8000`
   - **Admin Dashboard**: Accessible at `http://your-server-ip/admin` (Default: `admin` / `admin123`)

---

## 🛠️ Configuration (Optional)

You can modify the environment variables in the root `docker-compose.yml` file:

| Variable | Description |
|---|---|
| `FRONTEND_URL` | The public URL candidates will use to access the interview. |
| `BACKEND_URL` | The public URL of the API. |
| `SECRET_KEY` | Change this to a random string for production JWT security. |
| `MAIL_PASSWORD` | App-specific password for the invitation email worker. |

---

## 🧠 AI Performance Notes

*   **Phone Detection**: We have tuned the AI to a sensitivity of **0.3 (30%)**. It is now capable of detecting phone corners and edges, even if the candidate tries to hide the main body of the device.
*   **Hardware Audit**: The system continuously polls for external displays and HDMI connections. It is recommended to remind candidates to keep their laptop lids open for optimal camera performance.
*   **Security Protocol**: If a candidate disconnects the Chrome Extension during a session, the system will immediately flag a **Security Alert**.

---

## 📁 Maintenance

*   **Evidence Storage**: Proctoring videos are stored in the `./backend/uploads` volume on the host server.
*   **Database**: The MongoDB data is persisted in the `mongodb_data` volume.

*For further technical support, refer to the [product_pitch_report.md](file:///Reports/product_pitch_report.md).*
