# FocusFlow

A modern productivity application designed to help you focus on what matters most. Track tasks, manage your time, and visualize your progress with FocusFlow.

![FocusFlow](https://i.imgur.com/qHAcfhX.png)

## Features

- **Task Management**: Create, edit, and organize tasks with due dates and recurrence options
- **Progress Tracking**: Visualize your daily and weekly productivity with intuitive charts
- **Streak System**: Build habits with a streak system that tracks your daily progress
- **Bookmarks**: Save important links and resources for quick access
- **User Authentication**: Secure login with email/password or Google authentication
- **Cloud Sync**: All your data syncs across devices using Firebase
- **Dark Mode**: Toggle between light and dark themes for comfortable use

## Tech Stack

- **Frontend**: React with TypeScript
- **UI Components**: Shadcn UI with Tailwind CSS
- **Routing**: React Router
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **Hosting**: Firebase Hosting (optional)

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/Dhruv-Tuteja/FocusFlow.git
   cd FocusFlow
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your Firebase configuration:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

### Firebase Setup

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Google providers)
3. Create a Firestore database
4. Add your web app to the Firebase project to get the configuration values
5. Update your `.env` file with these values
6. Add your app's domain to the authorized domains list in Firebase Authentication settings

## Usage

### Task Management
- Add tasks with title, description, due date, and tags
- Mark tasks as complete
- Set recurring tasks (daily, weekly, monthly)
- Filter tasks by date or status

### Progress Tracking
- View daily completion rates
- Track your streak of consecutive days with completed tasks
- Analyze weekly and monthly productivity trends

### Profile
- View statistics about your productivity
- See your longest streaks
- Analyze task completion patterns

## Project Structure

```
/src
  /components      # UI components
  /contexts        # React contexts for state management
  /hooks           # Custom React hooks
  /lib             # Utility functions and Firebase setup
  /pages           # Main application pages
  /types           # TypeScript type definitions
  /utils           # Helper utilities
  App.tsx          # Main application component
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [React](https://reactjs.org/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Firebase](https://firebase.google.com/)
- [Vite](https://vitejs.dev/)
