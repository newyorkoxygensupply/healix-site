"""
Gunicorn production configuration for Healix.
Run: gunicorn -c gunicorn.conf.py app:app
"""
import multiprocessing, os

# Bind
bind        = os.getenv("BIND", "0.0.0.0:5000")

# Workers — SQLite edition: each worker uses ~40-60 MB RAM.
# Cap at 2 on Render free tier (512 MB). Increase via WEB_CONCURRENCY env var on paid plans.
workers     = int(os.getenv("WEB_CONCURRENCY", min(2, multiprocessing.cpu_count() * 2 + 1)))
worker_class = "gthread"
threads     = int(os.getenv("THREADS", 4))

# Timeouts
timeout          = 120   # allow up to 2 min for a slow image fetch
graceful_timeout = 30
keepalive        = 5

# Logging
accesslog  = "-"          # stdout
errorlog   = "-"          # stderr
loglevel   = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)sB %(D)sµs'

# Performance
worker_tmp_dir   = "/tmp"
preload_app      = True   # fork workers after startup; CATEGORIES/BRANDS shared via copy-on-write
max_requests     = 1000   # recycle workers to prevent memory creep
max_requests_jitter = 100
