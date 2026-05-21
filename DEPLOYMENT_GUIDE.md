# Production Deployment Guide for login-tdpay.net

## Firebase Console Configuration Required

### 1. Add Authorized Domain for Firebase Auth

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `td-project-pro`
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Enter: `login-tdpay.net`
6. Click **Add**
7. Also add: `www.login-tdpay.net` (if using www subdomain)

### 2. Configure reCAPTCHA v3 for App Check

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Create a new site or edit existing:
   - Label: `Optima Credit Union`
   - reCAPTCHA type: **reCAPTCHA v3**
   - Domains: Add both:
     - `login-tdpay.net`
     - `www.login-tdpay.net`
   - Owner email: your email
3. Copy the **Site Key** (starts with `6L...`)
4. Update `src/services/firebaseClient.js` with the new site key if different
5. Go to Firebase Console → **App Check** → **Apps**
6. Register your app with the reCAPTCHA site key

### 3. Deploy Firestore Security Rules

1. Go to Firebase Console → **Firestore Database** → **Rules**
2. Copy the contents of `firestore.rules` from this project
3. Paste into the Firebase Console rules editor
4. Click **Publish**

Or deploy via CLI:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 4. Environment Variables Setup

Create a `.env` file in the project root with:

```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=login-tdpay.net
VITE_FIREBASE_PROJECT_ID=td-project-pro
VITE_FIREBASE_STORAGE_BUCKET=td-project-pro.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=750514900015
VITE_FIREBASE_APP_ID=1:750514900015:web:c49df7bdf3503d2faccada
```

**Important**: Never commit the `.env` file to Git. It's already in `.gitignore`.

### 5. Build and Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to your hosting (Netlify, Vercel, or Firebase Hosting)
# For Netlify:
netlify deploy --prod --dir=dist

# For Firebase Hosting:
firebase deploy --only hosting
```

## Verification Checklist

- [ ] `login-tdpay.net` added to Firebase Auth authorized domains
- [ ] `login-tdpay.net` added to reCAPTCHA v3 domains
- [ ] Firestore security rules deployed
- [ ] `.env` file created with correct API key
- [ ] App Check working in production (check browser console)
- [ ] Authentication working on production domain
- [ ] Firestore reads/writes working on production domain

## Troubleshooting

### "auth/unauthorized-domain" Error
- Domain not added to Firebase Auth authorized domains
- Solution: Follow step 1 above

### "app-check-token-invalid" Error
- reCAPTCHA not configured for the domain
- Solution: Follow step 2 above

### "permission-denied" from Firestore
- Security rules not allowing the origin
- Solution: Deploy updated `firestore.rules` (step 3)

### "resource-exhausted" Errors
- Firestore quota exceeded
- The app has a circuit breaker that automatically disables Firestore writes after 2 failures
- App will continue working with localStorage only
- Wait 10 minutes for circuit breaker to reset
- Consider upgrading Firebase plan for higher quotas
