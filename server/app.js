const express = require("express");
const cors = require("cors");

const app = express();  //express() creates backend application instance

// Middleware
app.use(cors()); //cors() allows the frontend to communicate with the API 
app.use(express.json()); // lets express understand JSON data in the request body

// Health check route
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Business Operations Management System API is running"
    });
});

module.exports = app;