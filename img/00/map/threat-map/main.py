from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles                     # ← added
from fastapi.responses import FileResponse, RedirectResponse     # ← added
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict, deque
from time import time
from pydantic import BaseModel, EmailStr, field_validator
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
THREAT_DIR = os.path.join(STATIC_DIR, "threat-map")

app = FastAPI(title="Fuxi Contact API", docs_url=None, redoc_url=None)

# Serve all static files (HTML, CSS, JS, images, fonts, bootstrap...)
app.mount("/static", StaticFiles(directory=STATIC_DIR, html=True), name="static")
app.mount("/assets", StaticFiles(directory=os.path.join(THREAT_DIR, "assets")), name="threat_assets")
app.mount("/textures", StaticFiles(directory=os.path.join(THREAT_DIR, "textures")), name="threat_textures")

# Serve index.html at the root URL
@app.get("/index.html", response_class=FileResponse)
async def serve_index_html():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/index", response_class=FileResponse)
async def serve_index_clean():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/index")

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        response.headers["Server"] = ""
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob: https:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "worker-src 'none'; "
            "child-src 'self' blob:; "
            "connect-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com; "
            "frame-ancestors 'self'; "
            "frame-src 'self' https://www.google.com https://maps.googleapis.com https://maps.google.com;"
        )
        ct = response.headers.get("content-type", "")
        if ct.startswith("text/html"):
            response.headers["Cache-Control"] = "no-store, max-age=0"
        return response

app.add_middleware(SecurityHeadersMiddleware)

RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 20
_ip_hits = defaultdict(deque)

async def rate_limiter(request: Request):
    ip = (request.client and request.client.host) or "unknown"
    now = time()
    q = _ip_hits[ip]
    while q and now - q[0] > RATE_LIMIT_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many requests")
    q.append(now)

# Clean URLs for main pages (optional but recommended – no .html in URL)
@app.get("/company.html")
async def serve_company_html():
    return FileResponse(os.path.join(STATIC_DIR, "company.html"))

@app.get("/company")
async def serve_company_clean():
    return FileResponse(os.path.join(STATIC_DIR, "company.html"))

@app.get("/contact.html")
async def serve_contact_html():
    return FileResponse(os.path.join(STATIC_DIR, "contact.html"))

@app.get("/contact-us")
async def serve_contact_clean():
    return FileResponse(os.path.join(STATIC_DIR, "contact.html"))

@app.get("/products.html")
async def serve_products_html():
    return FileResponse(os.path.join(STATIC_DIR, "products.html"))

@app.get("/products")
async def serve_products_clean():
    return FileResponse(os.path.join(STATIC_DIR, "products.html"))

@app.get("/solutions.html")
async def serve_solutions_html():
    return FileResponse(os.path.join(STATIC_DIR, "solutions.html"))

@app.get("/solutions")
async def serve_solutions_clean():
    return FileResponse(os.path.join(STATIC_DIR, "solutions.html"))

# Threat Map page
@app.get("/threat-map.html")
async def serve_threat_map_html():
    return FileResponse(os.path.join(THREAT_DIR, "index.html"))

@app.get("/threatmap.html")
async def serve_threatmap_container_html():
    return FileResponse(os.path.join(STATIC_DIR, "threatmap.html"))

@app.get("/threatmap")
async def serve_threatmap_container_clean():
    return FileResponse(os.path.join(STATIC_DIR, "threatmap.html"))

@app.get("/blog")
async def serve_blog():
    return FileResponse(os.path.join(STATIC_DIR, "blog.html"))

@app.get("/vite.svg")
async def serve_vite_svg():
    return FileResponse(os.path.join(THREAT_DIR, "vite.svg"))

@app.get("/earth-clouds.png")
async def serve_earth_clouds():
    return FileResponse(os.path.join(THREAT_DIR, "earth-clouds.png"))

# ──────────────────────────────────────────────────────────────
#                  YOUR EXISTING CODE BELOW (unchanged)
# ──────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "http://localhost:8000", "http://10.181.1.*", "http://10.181.1.*:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

class ContactForm(BaseModel):
    name: str
    phone: str
    email: EmailStr
    subject: str
    message: str

    @field_validator('name', 'phone', 'subject', 'message')
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('This field is required')
        return v.strip()

    @field_validator('message')
    @classmethod
    def message_length(cls, v: str) -> str:
        if len(v) > 4000:
            raise ValueError('Message is too long')
        return v

@app.post("/contact")
async def send_contact(form: ContactForm, request: Request, _: None = Depends(rate_limiter)):
    try:
        sender    = os.getenv("SMTP_USER")
        password  = os.getenv("SMTP_PASSWORD")
        recipient = os.getenv("RECIPIENT", "mikemiao1995@gmail.com")

        if not all([sender, password]):
            print("SMTP disabled or missing credentials; storing submission locally")
            print(f"[CONTACT] {form.name} <{form.email}> | {form.phone} | {form.subject}")
            print(form.message)
            return {"success": True, "message": "Message received"}

        msg = MIMEMultipart()
        msg['From']    = sender
        msg['To']      = recipient
        msg['Subject'] = f"Contact Form: {form.subject}"

        body = f"""New contact form submission

Name:    {form.name}
Phone:   {form.phone}
Email:   {form.email}
Subject: {form.subject}

Message:
{form.message}
"""
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        try:
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
                server.starttls()
                server.login(sender, password)
                server.send_message(msg)
        except Exception as e:
            print(f"SMTP send failed: {e}")
            return {"success": True, "message": "Message received"}

        return {"success": True, "message": "Message sent successfully"}

    except Exception as e:
        print(f"Email error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send message. Please try again later."
        )
