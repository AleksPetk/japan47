# Japan47 Mobile

Native iPhone-focused client for Japan47, built with Expo SDK 54, React Native, and Expo Router. It consumes the same versioned Django REST API as the website, so accounts and content stay shared.

## Run in Expo Go

Use Node.js 20+ and install Expo Go on the iPhone.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the iPhone Camera app. The phone and computer must be on the same network. The app uses `https://japan47.alekspetk.com/api/v1` by default.

For local Django, copy `.env.example` to the ignored `.env.local` and use the computer's LAN IP, not `localhost` (which means the phone itself):

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api/v1
EXPO_PUBLIC_SITE_URL=http://192.168.x.x:5173
```

Restart Expo after environment changes.

## Checks

```bash
npx tsc --noEmit
npm run lint
npx expo export --platform ios
```

## Structure

- `app/` — file-based native routes and four-tab navigation
- `components/` — shared cards, forms, loading/error states, and profile UI
- `context/` — authentication lifecycle and current-user state
- `hooks/` — reusable API loading state
- `lib/` — API client, secure tokens, uploads, and runtime configuration
- `types/` — API response types

JWT tokens use `expo-secure-store`; images use the system picker. Both work in Expo Go.

## Email links

The backend currently sends verification and reset links to its configured web frontend. Native handlers exist for future deep links, but directing production HTTPS links into the app requires an associated-domain deployment and backend URL policy. Expo Go cannot claim the production domain.
