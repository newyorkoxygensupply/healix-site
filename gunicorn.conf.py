"""
Gunicorn production configuration for Healix.
Run: gunicorn -c gunicorn.conf.py app:app
"""
import multiprocessing, os

bind        = os.getenv("BIND", "0.0.0.0:5000")
workers     = int(os.getenv("WEB_CONCURRENCY", min(4, multiprocessing.cpu_count() * 2 + 1)))
worker_class = "gthread"
threads     = int(os.getenv("THREADS", 4))
timeout          = 120
graceful_timeout = 30
keepalive        = 5
accesslog  = "-"
errorlog   = "-"
loglevel   = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)sB %(D)sus'
worker_tmp_dir   = "/tmp"
preload_app      = True
max_requests     = 1000
max_requests_jitter = 100
