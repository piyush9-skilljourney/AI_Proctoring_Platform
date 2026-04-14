from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from app.core.config import settings
from pydantic import EmailStr
import os

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_invitation_email(email: str, candidate_name: str, job_title: str, invite_link: str):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #6366f1;">HyrAI Proctoring</h1>
        </div>
        <p>Dear <strong>{candidate_name}</strong>,</p>
        <p>You have been invited to participate in a proctored interview for the position of <strong>{job_title}</strong>.</p>
        <p>This session is monitored by our AI Proctoring Engine to ensure technical integrity. Please ensure you are in a well-lit, quiet environment before starting.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{invite_link}" style="background-color: #6366f1; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Start My Interview</a>
        </div>
        
        <p style="font-size: 14px; color: #666;">If the button above does not work, copy and paste the following link into your browser:</p>
        <p style="font-size: 12px; color: #6366f1; word-break: break-all;">{invite_link}</p>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;">
        <p style="font-size: 12px; color: #999; text-align: center;">&copy; 2026 HyrAI Proctoring Solutions</p>
    </div>
    """
    
    message = MessageSchema(
        subject=f"Invitation: Interview for {job_title}",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)
