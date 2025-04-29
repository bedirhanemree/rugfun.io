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
function initializeJeets() {
    jeets = [];
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
            attachedPlayerId: null,
            attachTimer: 0,
            orbitAngle: 0,
            opacity: 1,
        });
    }
    console.log("Initialized jeets:", jeets.length, jeets); // Hata ayıklama
}

function spawnNewJeet() {
    const wallet = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
    const newJeet = {
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
        attachedPlayerId: null,
        attachTimer: 0,
        orbitAngle: 0,
        opacity: 1,
    };
    console.log("Spawned new jeet:", newJeet); // Hata ayıklama
    return newJeet;
}

initializeJeets();

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

function updateRadius(entity) {
    const baseRadius = 20;
    const divisor = 1000000;
    const multiplier = 60;
    entity.radius = baseRadius + (entity.marketcap || entity.wallet) / divisor * multiplier;
    entity.radius = Math.max(20, Math.min(100, entity.radius));
}

function moveJeets() {
    for (let i = jeets.length - 1; i >= 0; i--) {
        let jeet = jeets[i];
        updateRadius(jeet);
        if (jeet.attached) {
            const player = players.find(p => p.id === jeet.attachedPlayerId);
            if (!player || !player.isAlive) {
                jeet.attached = false;
                jeet.attachedPlayerId = null;
                jeet.flame = true;
                jeet.flameTimer = 120;
                jeet.shakeTimer = 30;
                jeet.angle = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2][Math.floor(Math.random() * 4)];
                continue;
            }

            jeet.orbitAngle += 0.05;
            const orbitRadius = player.radius + jeet.radius + 10;
            jeet.x = player.x + Math.cos(jeet.orbitAngle) * orbitRadius;
            jeet.y = player.y + Math.sin(jeet.orbitAngle) * orbitRadius;

            jeet.attachTimer--;
            if (jeet.attachTimer <= 0) {
                jeet.attached = false;
                jeet.attachedPlayerId = null;
                jeet.flame = true;
                jeet.flameTimer = 120;
                jeet.shakeTimer = 30;
                player.shakeTimer = 30;
                const stolenAmount = jeet.wallet;
                player.marketcap -= stolenAmount;
                if (player.marketcap <= 0) {
                    player.marketcap = 0;
                    player.isAlive = false;
                    io.emit('player-died', player.id);
                }
                updateRadius(player);
                const edgeAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
                jeet.angle = edgeAngles[Math.floor(Math.random() * edgeAngles.length)];
            }
            continue;
        }

        let jeetSpeed = jeet.speed;
        let closestPlayer = null;
        let minDist = Infinity;

        for (let player of players) {
            if (!player.isAlive) continue;
            const dx = player.x - jeet.x;
            const dy = player.y - jeet.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                closestPlayer = player;
            }
        }

        if (jeet.flame && jeet.flameTimer > 0) {
            jeetSpeed *= 5;
            jeet.flameTimer--;
            jeet.opacity -= 1 / 120;
            jeet.x += Math.cos(jeet.angle) * jeetSpeed;
            jeet.y += Math.sin(jeet.angle) * jeetSpeed;

            if (jeet.flameTimer <= 0 || jeet.x < 0 || jeet.x > mapWidth || jeet.y < 0 || jeet.y > mapHeight) {
                jeets.splice(i, 1);
                jeets.push(spawnNewJeet());
                continue;
            }
        } else if (closestPlayer && minDist < 2000 && closestPlayer.marketcap >= jeet.wallet) {
            if (!jeet.angry) {
                jeet.angry = true;
                jeet.angryTimer = 900;
            }
            if (jeet.angry) {
                jeetSpeed *= 2;
                const dx = closestPlayer.x - jeet.x;
                const dy = closestPlayer.y - jeet.y;
                jeet.angle = Math.atan2(dy, dx);
                jeet.angryTimer--;
                if (jeet.angryTimer <= 0) {
                    jeet.angry = false;
                }
            }
        } else {
            jeet.angry = false;
            jeet.angle += (Math.random() - 0.5) * 0.3;
        }

        jeet.x += Math.cos(jeet.angle) * jeetSpeed;
        jeet.y += Math.sin(jeet.angle) * jeetSpeed;
        if (jeet.x < 0 || jeet.x > mapWidth) jeet.angle = Math.PI - jeet.angle;
        if (jeet.y < 0 || jeet.y > mapHeight) jeet.angle = -jeet.angle;

        if (jeet.shakeTimer > 0) jeet.shakeTimer--;
    }
    console.log("Updated jeets:", jeets.length, jeets); // Hata ayıklama
}

function moveDots() {
    for (let dot of dots) {
        dot.angle += (Math.random() - 0.5) * 0.3;
        dot.x += Math.cos(dot.angle) * dot.type.speed;
        dot.y += Math.sin(dot.angle) * dot.type.speed;

        if (dot.x < 0 || dot.x > mapWidth) dot.angle = Math.PI - dot.angle;
        if (dot.y < 0 || dot.y > mapHeight) dot.angle = -dot.angle;
    }
}

setInterval(() => {
    moveDots();
    moveJeets();
    console.log("Sending game state - Jeets:", jeets.length); // Hata ayıklama
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

    socket.on('jeet-attached', (jeetIndex, playerId) => {
        const jeet = jeets[jeetIndex];
        if (jeet && !jeet.attached && !jeet.flame) {
            jeet.attached = true;
            jeet.attachedPlayerId = playerId;
            jeet.orbitAngle = Math.random() * Math.PI * 2;
            const attachDurations = [180, 300, 420, 600, 780];
            jeet.attachTimer = attachDurations[Math.floor(Math.random() * attachDurations.length)];
            console.log(`Jeet ${jeetIndex} attached to player ${playerId}`); // Hata ayıklama
            io.emit('update-game-state', { dots, jeets, rugs, businesses });
        }
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
