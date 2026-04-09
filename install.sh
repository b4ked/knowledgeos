#!/bin/bash
set -e

# ─── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
die()  { echo -e "${RED}✗${NC}  $1"; exit 1; }
step() { echo -e "\n${YELLOW}→${NC} $1"; }

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  KnowledgeOS Installer"
echo "  ─────────────────────"

# ─── 1. Check Node.js ─────────────────────────────────────────────────────────
step "Checking Node.js"
if ! command -v node &>/dev/null; then
  die "Node.js not found.\n   Install it from https://nodejs.org (LTS version recommended)."
fi
NODE_MAJ=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJ" -lt 18 ]; then
  die "Node.js 18 or later required (found $(node -v)).\n   Download from https://nodejs.org"
fi
ok "Node.js $(node -v)"

# ─── 2. Install dependencies ──────────────────────────────────────────────────
step "Installing dependencies"
cd "$REPO_DIR"
npm install --silent
ok "Dependencies installed"

# ─── 3. Configure environment ─────────────────────────────────────────────────
step "Configuring environment"

VAULT_DIR="$HOME/Documents/KnowledgeOS"

if [ -f "$REPO_DIR/.env.local" ]; then
  warn ".env.local already exists — skipping API key prompt."
  warn "Edit $REPO_DIR/.env.local to change settings."
else
  echo ""
  echo "  KnowledgeOS uses an AI provider to compile notes and power chat."
  echo "  You need an API key from one of:"
  echo ""
  echo "    Anthropic  https://console.anthropic.com  (default)"
  echo "    OpenAI     https://platform.openai.com"
  echo ""
  read -rp "  Provider [anthropic/openai, default: anthropic]: " PROVIDER
  PROVIDER="${PROVIDER:-anthropic}"

  if [ "$PROVIDER" = "openai" ]; then
    read -rp "  OpenAI API key (sk-...): " API_KEY
    cat > "$REPO_DIR/.env.local" <<ENV
VAULT_PATH=$VAULT_DIR
LLM_PROVIDER=openai
OPENAI_API_KEY=$API_KEY
ENV
  else
    read -rp "  Anthropic API key (sk-ant-...): " API_KEY
    cat > "$REPO_DIR/.env.local" <<ENV
VAULT_PATH=$VAULT_DIR
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=$API_KEY
ENV
  fi
  ok ".env.local created"
fi

# ─── 4. Create vault directories ──────────────────────────────────────────────
step "Setting up vault"
mkdir -p "$VAULT_DIR/raw" "$VAULT_DIR/wiki"
ok "Vault ready at $VAULT_DIR"

# ─── 5. Build production bundle ───────────────────────────────────────────────
step "Building application (this takes ~30 seconds)"
npm run build --silent
ok "Build complete"

# ─── 6. Create KnowledgeOS.app bundle ─────────────────────────────────────────
step "Creating KnowledgeOS.app"

APP="$REPO_DIR/KnowledgeOS.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"

# Info.plist
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>           <string>KnowledgeOS</string>
  <key>CFBundleDisplayName</key>    <string>KnowledgeOS</string>
  <key>CFBundleIdentifier</key>     <string>com.knowledgeos.app</string>
  <key>CFBundleVersion</key>        <string>1.0</string>
  <key>CFBundleShortVersionString</key> <string>1.0</string>
  <key>CFBundleExecutable</key>     <string>KnowledgeOS</string>
  <key>CFBundlePackageType</key>    <string>APPL</string>
  <key>LSMinimumSystemVersion</key> <string>11.0</string>
  <key>LSUIElement</key>            <false/>
  <key>NSHighResolutionCapable</key> <true/>
</dict>
</plist>
PLIST

# Launcher — bake the repo path in at install time
cat > "$APP/Contents/MacOS/KnowledgeOS" <<LAUNCHER
#!/bin/bash
REPO="$REPO_DIR"
PORT=3000
PIDFILE="/tmp/knowledgeos.pid"
LOGFILE="/tmp/knowledgeos.log"

# If server is already running on this port, just open the window
if lsof -ti :\$PORT &>/dev/null; then
  :  # fall through to open
else
  # Start Next.js production server
  cd "\$REPO"
  nohup npm start --prefix "\$REPO" > "\$LOGFILE" 2>&1 &
  echo \$! > "\$PIDFILE"

  # Wait up to 20 seconds for server to respond
  for i in \$(seq 1 40); do
    if curl -sf http://localhost:\$PORT >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
fi

# Open in Chrome app mode (no browser chrome — feels native)
# Falls back through Arc → Chromium → default browser
if open -Ra "Google Chrome" 2>/dev/null; then
  open -a "Google Chrome" --args --app=http://localhost:\$PORT --window-size=1400,900 --window-position=100,50
elif open -Ra "Arc" 2>/dev/null; then
  open -a "Arc" http://localhost:\$PORT
elif open -Ra "Chromium" 2>/dev/null; then
  open -a "Chromium" --args --app=http://localhost:\$PORT --window-size=1400,900
elif open -Ra "Brave Browser" 2>/dev/null; then
  open -a "Brave Browser" --args --app=http://localhost:\$PORT --window-size=1400,900
elif open -Ra "Microsoft Edge" 2>/dev/null; then
  open -a "Microsoft Edge" --args --app=http://localhost:\$PORT --window-size=1400,900
else
  open "http://localhost:\$PORT"
fi
LAUNCHER

chmod +x "$APP/Contents/MacOS/KnowledgeOS"
ok "KnowledgeOS.app created"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  Installation complete!${NC}"
echo ""
echo "  Your app:   $APP"
echo "  Your vault: $VAULT_DIR"
echo ""
echo "  ┌─ To launch ───────────────────────────────────────────────────────┐"
echo "  │  Double-click KnowledgeOS.app                                     │"
echo "  │  Or drag it to your Applications folder first                     │"
echo "  └───────────────────────────────────────────────────────────────────┘"
echo ""
echo "  Note: On first open macOS may show a security warning."
echo "  Right-click KnowledgeOS.app → Open → Open to allow it."
echo ""
