# UPI Project API Documentation

## Overview
This API provides a Unified Payments Interface (UPI) system built with Node.js, Express.js, PostgreSQL, and Redis. It allows users to sign up, log in, create UPI pins, make payments, check balances, and view transaction history.

## Base URL
```
http://localhost:3000
```

## Authentication
The API uses JWT (JSON Web Tokens) for authentication. After logging in, include the token in the `Authorization` header as `Bearer <token>` for protected routes.

### Token Expiration
- Tokens are valid for 1 hour.
- Logging out blacklists the token in Redis.

## Endpoints

### Authentication Routes

#### 1. Sign Up
- **Endpoint**: `POST /api/auth/signup`
- **Description**: Register a new user.
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  - Success (201):
    ```json
    {
      "message": "User created!",
      "user": {
        "id": "number",
        "username": "string",
        "vpa": "string"
      }
    }
    ```
  - Error (500):
    ```json
    {
      "error": "string"
    }
    ```

#### 2. Log In
- **Endpoint**: `POST /api/auth/login`
- **Description**: Authenticate user and receive JWT token.
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "message": "Login Successful",
      "token": "string"
    }
    ```
  - Error (400/500):
    ```json
    {
      "error": "string"
    }
    ```

#### 3. Log Out
- **Endpoint**: `POST /api/auth/logout`
- **Description**: Invalidate the current JWT token.
- **Headers**:
  ```
  Authorization: Bearer <token>
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "message": "Logged out successfully"
    }
    ```

### Transaction Routes
All transaction routes require authentication (JWT token in header).

#### 1. Create UPI Pin
- **Endpoint**: `POST /api/createpin`
- **Description**: Set a PIN for UPI transactions.
- **Headers**:
  ```
  Authorization: Bearer <token>
  ```
- **Request Body**:
  ```json
  {
    "pin": "string"
  }
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "message": "Pin created successfully..."
    }
    ```
  - Error (400):
    ```json
    {
      "error": "string"
    }
    ```

#### 2. Make Payment
- **Endpoint**: `POST /api/pay`
- **Description**: Transfer money to another UPI ID.
- **Headers**:
  ```
  Authorization: Bearer <token>
  ```
- **Request Body**:
  ```json
  {
    "receiver_vpa": "string",
    "amount": "number",
    "category": "string",
    "pin": "string"
  }
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "success": true,
      "message": "Transaction Successful",
      "transaction_id": "number"
    }
    ```
  - Error (400):
    ```json
    {
      "error": "string"
    }
    ```

#### 3. Check Balance
- **Endpoint**: `GET /api/balance`
- **Description**: Get the current account balance.
- **Headers**:
  ```
  Authorization: Bearer <token>
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "balance": "number"
    }
    ```
  - Error (400):
    ```json
    {
      "error": "string"
    }
    ```

#### 4. Transaction History
- **Endpoint**: `GET /api/history`
- **Description**: Get list of all transactions (sent and received).
- **Headers**:
  ```
  Authorization: Bearer <token>
  ```
- **Response**:
  - Success (200):
    ```json
    {
      "transactions": [
        {
          "id": "number",
          "sender_vpa": "string",
          "receiver_vpa": "string",
          "amount": "number",
          "category": "string",
          "status": "string",
          "timestamp": "string"
        }
      ]
    }
    ```
  - Error (400):
    ```json
    {
      "error": "string"
    }
    ```

## Database Schema
- **users**: Stores user information (username, vpa, balance, password).
- **upi**: Stores UPI pins linked to vpa.
- **transactions**: Records all payment transactions.

## Caching
- Redis is used to cache VPA existence checks for performance.
- Blacklisted tokens are stored in Redis for logout functionality.

## Running the Application
- **Locally**: `node server.js`
- **With Docker**: `docker-compose up`

## Notes
- All monetary values are in decimal format (e.g., 100.00).
- VPA format: `username@upi`.
- Ensure PostgreSQL and Redis are running before starting the app.