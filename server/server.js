const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'client')));

const mapWidth = 10000;
const mapHeight = 10000;

let players = [];

const foodTypes = [
    { emoji: "🐛", min: 100, max: 1000, speed: 0.2, size: 8, color: "#66ff66" },
    { emoji: "🐟", min: 1000, max: 5000, speed: 0.4, size: 12, color: "#66ccff" },
    { emoji: "🦈", min: 5000, max: 10000, speed: 0.6, size: 16, color: "#ff9966" },
    { emoji: "🐋", min: 10000, max: 100000, speed: 1.0, size: 24, color: "#ff66cc" },
];

let dots = [];
for (let i = 0; i < 1000; i++) {
    const rand = Math.random();
    let type;
    if (rand < 0.6) type = foodTypes[0];
    else if (rand < 0.85) type = foodTypes[1];
    else if (rand < 0.97) type = foodTypes[2];
    else type = foodTypes[3];

    dots.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        type,
        wallet: Math.floor(Math.random() * (type.max - type.min)) + type.min,
        angle: Math.random() * Math.PI * 2,
    });
}

let jeets = [];
for (let i = 0; i < 20; i++) {
    const wallet = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
    jeets.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        radius: 20 + (wallet / 1000000) * 30,
        speed: 1,
        angle: Math.random() * Math.PI * 2,
        angry: false,
        angryTimer: 0,
        wallet: wallet,
        flame: false,
        flameTimer: 0,
        shakeTimer: 0,
        attached: false,
        attachTimer: 0,
        orbitAngle: 0,
        opacity: 1,
    });
}

function spawnNewJeet() {
    const wallet = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
    return {
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        radius: 20 + (wallet / 1000000) * 30,
        speed: 1,
        angle: Math.random() * Math.PI * 2,
        angry: false,
        angryTimer: 0,
        wallet: wallet,
        flame: false,
        flameTimer: 0,
        shakeTimer: 0,
        attached: false,
        attachTimer: 0,
        orbitAngle: 0,
        opacity: 1,
    };
}

let rugs = [];
for (let i = 0; i < 5; i++) {
    rugs.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        radius: 20,
        active: Math.random() > 0.5,
    });
}

let businesses = [
    { x: 200, y: 200, radius: 20, color: 'green', income: 50 },
    { x: 800, y: 800, radius: 20, color: 'green', income: 50 }
];

function moveDots() {
    for (
