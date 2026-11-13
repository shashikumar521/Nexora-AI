# Nexora AI 🤖

### An AI-Powered Conversational Chatbot

Nexora AI is an intelligent chatbot application powered by Google's Gemini API. It provides an interactive conversational experience with multi-turn conversation memory and context management.

## 🚀 Features

- **Gemini AI Integration:** Generates intelligent responses using Google's Gemini API.
- **Multi-Turn Conversations:** Maintains conversation history so users can continue previous discussions.
- **Context Management:** Manages conversation context using a limited message window.
- **Custom System Prompt:** Provides the chatbot with a defined identity and behaviour.
- **Error Handling:** Handles API errors and connection failures with user-friendly messages.
- **Dark and Light Themes:** Offers two visual themes.
- **Conversation Management:** Supports starting new chats and managing conversation context.
- **Responsive Interface:** Provides a modern chatbot experience.

## 🛠️ Technologies Used

- Frontend: JavaScript and the technologies used in this project.
- Backend: Node.js (if applicable to your implementation).
- AI Model: Google Gemini API.
- Version Control: Git and GitHub.

## 🧠 How It Works

1. The user enters a message in the chat interface.
2. The frontend sends the message to the backend.
3. The backend manages conversation history and context.
4. The backend sends the relevant conversation context to the Gemini API.
5. Gemini generates a response.
6. The response is returned to the frontend and displayed to the user.

## 🔐 Environment Configuration

The application uses environment variables to protect API credentials.

Create a `.env` file in the required backend location and configure:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Never upload your actual `.env` file or API credentials to GitHub.

Refer to `.env.example` for the required environment variable names.

## ⚙️ Installation and Setup

1. Clone the repository:

```bash
git clone https://github.com/shashikumar521/Nexora-AI.git
```

2. Open the project directory:

```bash
cd Nexora-AI
```

3. Install dependencies according to the project's package configuration:

```bash
npm install
```

4. Configure the required environment variables.

5. Start the application using the appropriate development command defined in `package.json`.

## 🧪 Testing

The project includes testing for:

- Basic AI conversations.
- Multi-turn conversation memory.
- Context window management.
- API error handling.
- API key security.

## 🎯 Project Objective

The objective of Nexora AI is to demonstrate how a real Large Language Model API can be integrated into a chatbot application with conversation history, context management, secure API configuration and error handling.

## 👨‍💻 Author

**Shashikumar**

GitHub: https://github.com/shashikumar521

## 📌 Project

Nexora AI – AI-Powered Conversational Chatbot

Built as an internship project.
