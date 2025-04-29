const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, '../client')));

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
    for (let dot of dots) {
        dot.angle += (Math.random() - 0.5) * 0.3;
        dot.x += Math.cos(dot.angle) * dot.type.speed;
        dot.y += Math.sin(dot.angle) * dot.type.speed;

        if (dot.x < 0 || dot.x > mapWidth) dot.angle = Math.PI - dot.angle;
        if (dot.y < 0 || dot.y > mapHeight) dot.angle = -dot.angle;
    }
}

function moveJeets() {
    for (let i = 0; i < jeets.length; i++) {
        let jeet = jeets[i];
        let jeetSpeed = jeet.speed;

        if (jeet.flame && jeet.flameTimer > 0) {
            jeetSpeed *= 5;
            jeet.flameTimer--;
            jeet.opacity -= 1 / 120;
            jeet.x += Math.cos(jeet.angle) * jeetSpeed;
            jeet.y += Math.sin(jeet.angle) * jeetSpeed;

            if (jeet.flameTimer <= 0 || jeet.x < 0 || jeet.x > mapWidth || jeet.y < 0 || jeet.y > mapHeight) {
                jeets.splice(i, 1);
                jeets.push(spawnNewJeet());
                i--;
            }
        } else {
            jeet.angle += (Math.random() - 0.5) * 0.3;
            jeet.x += Math.cos(jeet.angle) * jeetSpeed;
            jeet.y += Math.sin(jeet.angle) * jeetSpeed;
            if (jeet.x < 0 || jeet.x > mapWidth) jeet.angle = Math.PI - jeet.angle;
            if (jeet.y < 0 || jeet.y > mapHeight) jeet.angle = -jeet.angle;
        }

        if (jeet.shakeTimer > 0) jeet.shakeTimer--;
    }
}

setInterval(() => {
    moveDots();
    moveJeets();
    io.emit('update-game-state', { dots, jeets, rugs, businesses });
}, 1000 / 60);

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı:', socket.id);

    socket.emit('init-game-state', { dots, jeets, rugs, businesses });
    socket.emit('init-players', players);

    socket.on('update-player', (playerData) => {
        playerData.id = socket.id;
        const existingPlayer = players.find(p => p.id === socket.id);
        if (existingPlayer) {
            Object.assign(existingPlayer, playerData);
        } else {
            players.push({
                ...playerData,
                isAlive: true,
                allHolders: playerData.allHolders || [],
                slimePoints: playerData.slimePoints || [],
                slimeDeform: playerData.slimeDeform || 0
            });
        }
        console.log('Updated players:', players);
        io.emit('update-players', players);
    });

    socket.on('dot-collected', (dotIndex) => {
        dots.splice(dotIndex, 1);
        io.emit('update-game-state', { dots, jeets, rugs, businesses });
    });

    socket.on('jeet-attached', (jeetIndex) => {
        const jeet = jeets[jeetIndex];
        jeet.attached = true;
        jeet.orbitAngle = Math.random() * Math.PI * 2;
        const attachDurations = [180, 300, 420, 600, 780];
        jeet.attachTimer = attachDurations[Math.floor(Math.random() * attachDurations.length)];
        io.emit('update-game-state', { dots, jeets, rugs, businesses });
    });

    socket.on('rug-collided', (rugIndex) => {
        rugs[rugIndex].active = false;
        setTimeout(() => {
            rugs[rugIndex].active = true;
            io.emit('update-game-state', { dots, jeets, rugs, businesses });
        }, 30000);
        io.emit('update-game-state', { dots, jeets, rugs, businesses });
    });

    socket.on('player-died', (playerId) => {
        players = players.filter(p => p.id !== playerId);
        io.emit('update-players', players);
    });

    socket.on('player-rugged', (playerId) => {
        players = players.filter(p => p.id !== playerId);
        io.emit('update-players', players);
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        players = players.filter(p => p.id !== socket.id);
        io.emit('update-players', players);
    });
});

server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
