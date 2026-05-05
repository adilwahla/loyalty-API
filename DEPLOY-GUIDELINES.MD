Good — now that everything is stable, here is your **final professional deployment SOP (Standard Operating Procedure)** for updating your **Loyalty API on Bluehost via GitHub**.

Save this — this is your **go-to checklist every time**.

---

# 🚀 FULL DEPLOYMENT PROCEDURE (PRODUCTION SAFE)

## 🔐 Step 0 — Always login as correct user

```bash
ssh beqe49lu@server-623728.binshihongroup.com
```

OR if already inside server:

```bash
su - beqe49lu
```

👉 Never use root for PM2

---

# 📦 Step 1 — Go to API project

```bash
cd ~/public_html/api.binshihongroup.com/loyalty-api
```

---

# 🛡️ Step 2 — Backup `.env` (critical safety)

```bash
cp .env .env.backup
```

---

# 🔄 Step 3 — Pull latest code from GitHub

```bash
git fetch origin
git reset --hard origin/production
```

### ✅ Why this method:

* no merge conflicts
* no broken builds
* server = exact GitHub code

---

# 🔁 Step 4 — Restore `.env`

```bash
mv .env.backup .env
```

---

# 📦 Step 5 — Install dependencies

```bash
npm install
```

---

# 🔄 Step 6 — Restart API

```bash
pm2 restart api-binshihon
```

---

# 💾 Step 7 — Save PM2 state

```bash
pm2 save
```

---

# 🔍 Step 8 — Verify everything

## Check process

```bash
pm2 list
```

Expected:

```
api-binshihon   online
```

---

## Check logs

```bash
pm2 logs api-binshihon --lines 50
```

Look for:

```
✅ Database synced
🚀 Server running on port 5000
```

---

## Test API

```bash
curl http://127.0.0.1:5000/socket-health
```

or browser:

```
https://api.binshihongroup.com/socket-health
```

---

# ⚠️ RULES YOU MUST FOLLOW (VERY IMPORTANT)

## ❌ NEVER DO THIS:

```bash
git pull
```

👉 Causes conflicts (you already faced this)

---

## ❌ NEVER RUN PM2 AS ROOT

Always:

```bash
su - beqe49lu
```

---

## ❌ NEVER EDIT FILES DIRECTLY ON SERVER

Always:

```text
Local → GitHub → Server
```

---

# ✅ CORRECT FLOW (YOUR SYSTEM)

```text
1. Make changes locally
2. Push to GitHub (production branch)
3. SSH into server
4. git reset --hard origin/production
5. npm install
6. pm2 restart api-binshihon
```

---

# ⚡ ONE-LINE DEPLOY (FAST METHOD)

Once comfortable, use this:

```bash
cd ~/public_html/api.binshihongroup.com/loyalty-api && \
git fetch origin && \
git reset --hard origin/production && \
npm install && \
pm2 restart api-binshihon
```

---

# 🧠 OPTIONAL (SAFE DEPLOY WITH BACKUP)

Before updating:

```bash
cp -r loyalty-api loyalty-api_backup_$(date +%F_%H-%M)
```

---

# 🔥 YOUR FINAL INFRA STRUCTURE

```text
API → port 5000
SMS → port 3000
PM2 → managing both
Apache → reverse proxy via .htaccess
```

---

# 💡 PRO TIPS (FOR YOUR PROJECT)

### ✅ After major updates:

```bash
pm2 restart all
```

---

### ✅ If something breaks:

```bash
pm2 logs api-binshihon
```

---

### ✅ If PM2 disappears:

```bash
pm2 start src/app.js --name api-binshihon
pm2 save
```

---

# 🎯 DONE — YOU NOW HAVE A PRODUCTION DEPLOY FLOW

---

