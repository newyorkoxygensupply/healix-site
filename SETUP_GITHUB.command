#!/bin/bash
cd "$(dirname "$0")"

echo "======================================"
echo "  Healix — GitHub Setup & Push"
echo "======================================"
echo ""

# Remove stale git lock if present
rm -f .git/index.lock 2>/dev/null

# Remove old .git if any, start fresh
rm -rf .git
git init
git branch -m main

# Configure git identity if not set
if [ -z "$(git config --global user.email)" ]; then
  echo "Enter your GitHub email address:"
  read GIT_EMAIL
  git config --global user.email "$GIT_EMAIL"
  git config --global user.name "Healix"
fi

# Stage all files (CSV is in .gitignore, so it won't be included)
git add .
git commit -m "Initial commit — Healix medical supply site"

echo ""
echo "======================================"
echo "  GitHub Credentials"
echo "======================================"
echo ""
echo "You need a GitHub Personal Access Token."
echo ""
echo "To create one:"
echo "  1. Go to: https://github.com/settings/tokens/new"
echo "  2. Give it a name like 'healix-deploy'"
echo "  3. Set expiration to 'No expiration'"
echo "  4. Check the box: repo (full control)"
echo "  5. Click 'Generate token' and COPY the token"
echo ""
echo "Enter your GitHub username:"
read GITHUB_USER

echo "Enter your Personal Access Token (paste it here — it won't show):"
read -s GITHUB_TOKEN
echo ""

echo "Enter the name for your new GitHub repository (e.g. healix-site):"
read REPO_NAME

echo ""
echo "Creating repository on GitHub..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$REPO_NAME\", \"private\": false}" \
  https://api.github.com/user/repos)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "201" ]; then
  echo "Repository created!"
else
  echo "Repo may already exist — continuing..."
fi

# Push code (without CSV)
git remote remove origin 2>/dev/null
git remote add origin "https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git"
git push -u origin main

if [ $? -ne 0 ]; then
  echo "Push failed. Check your username/token and try again."
  read; exit 1
fi

echo ""
echo "Code pushed! Now uploading the CSV as a GitHub Release..."

# Create a release
RELEASE_RESPONSE=$(curl -s \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag_name":"v1.0","name":"Data Files","body":"CSV data for Healix"}' \
  "https://api.github.com/repos/$GITHUB_USER/$REPO_NAME/releases")

UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('upload_url','').replace('{?name,label}',''))" 2>/dev/null)

if [ -z "$UPLOAD_URL" ]; then
  echo "Could not create release. Trying to fetch existing release..."
  UPLOAD_URL=$(curl -s \
    -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$GITHUB_USER/$REPO_NAME/releases/latest" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('upload_url','').replace('{?name,label}',''))" 2>/dev/null)
fi

echo "Uploading medical_supplies.csv (321MB — this may take a few minutes)..."

UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary @medical_supplies.csv \
  "${UPLOAD_URL}?name=medical_supplies.csv")

UPLOAD_CODE=$(echo "$UPLOAD_RESPONSE" | tail -1)

if [ "$UPLOAD_CODE" = "201" ]; then
  CSV_URL="https://github.com/$GITHUB_USER/$REPO_NAME/releases/download/v1.0/medical_supplies.csv"
  echo ""
  echo "======================================"
  echo "  ALL DONE!"
  echo "======================================"
  echo ""
  echo "Repo: https://github.com/$GITHUB_USER/$REPO_NAME"
  echo ""
  echo "======================================"
  echo "  SAVE THIS — needed for Render setup:"
  echo "======================================"
  echo ""
  echo "Build Command:"
  echo "  pip install -r requirements.txt && curl -L \"$CSV_URL\" -o medical_supplies.csv"
  echo ""
  echo "Start Command:"
  echo "  gunicorn -c gunicorn.conf.py app:app"
  echo ""
  # Save to a file for easy copy-paste
  cat > RENDER_COMMANDS.txt << EOF
=== Render Deployment Commands ===

Build Command:
pip install -r requirements.txt && curl -L "$CSV_URL" -o medical_supplies.csv

Start Command:
gunicorn -c gunicorn.conf.py app:app

=== Environment Variables (add in Render dashboard) ===
SITE_URL = https://your-app-name.onrender.com   (update after deploy)
SITE_NAME = Healix
PEXELS_API_KEY = (your Pexels key if you have one)
EOF
  echo "Commands saved to RENDER_COMMANDS.txt on your Desktop."
else
  echo "CSV upload failed (code $UPLOAD_CODE). You can upload it manually at:"
  echo "  https://github.com/$GITHUB_USER/$REPO_NAME/releases"
fi

echo ""
echo "Press Enter to close..."
read
