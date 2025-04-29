const startScreen = document.getElementById("startScreen");
const coinNameInput = document.getElementById("coinName");
const coinImageInput = document.getElementById("coinImage");
const startButton = document.getElementById("startButton");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const failedText = document.getElementById("failedText");
const restartText = document.getElementById("restartText");

const socket = io();

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const mapWidth = 10000;
const mapHeight = 10000;

let gameStarted = false;
let gameOver = false;

let player = {
    id: Math.random().toString(36).substr(2, 9),
    x: mapWidth / 2,
    y: mapHeight / 2,
    radius: 30,
    name: "RUGFUN",
    marketcap: 1000,
    color: "#33ff33",
    speed: 2,
    maxSpeed: 5,
    image: null,
    zoom: 1,
    stamina: 100,
    maxStamina: 100,
    shakeTimer: 0,
    boostCooldown: false,
    slimePoints: [],
    slimeDeform: 0,
    allHolders: [],
    holders: [],
    hasBonded: false,
};

function initializeSlimePoints() {
    const numPoints = 20;
    player.slimePoints = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        player.slimePoints.push({
            x: player.x + Math.cos(angle) * player.radius,
            y: player.y + Math.sin(angle) * player.radius,
            targetX: 0,
            targetY: 0,
            vx: 0,
            vy: 0,
        });
    }
}

initializeSlimePoints();

function updateRadius(entity) {
    const baseRadius = 20;
    const divisor = 1000000;
    const multiplier = 60;
    entity.radius = baseRadius + (entity.marketcap || entity.wallet) / divisor * multiplier;
    entity.radius = Math.max(20, Math.min(100, entity.radius));
    initializeSlimePoints();
}

updateRadius(player);

let players = [];
let target = { x: canvas.width / 2, y: canvas.height / 2 };

let boostActive = false;
let boostTimer = 0;

let particles = [];

const foodTypes = [
    { emoji: "🐛", min: 100, max: 1000, speed: 0.2, size: 8, color: "#66ff66" },
    { emoji: "🐟", min: 1000, max: 5000, speed: 0.4, size: 12, color: "#66ccff" },
    { emoji: "🦈", min: 5000, max: 10000, speed: 0.6, size: 16, color: "#ff9966" },
    { emoji: "🐋", min: 10000, max: 100000, speed: 1.0, size: 24, color: "#ff66cc" },
];

const memecoinNames = ["DOGEFUN", "SHIBKING", "PEPEMOON", "WIFHAT", "FLOKIROCKET"];
const memecoinEmojis = ["🐶", "🐕", "🐸", "🧢", "🚀"];

const dots = [];
const trail = [];

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

const jeetImage = new Image();
jeetImage.src = "jeet.png";
const jeetAngryImage = new Image();
jeetAngryImage.src = "jeet_angry.png";

let jeets = [];
for (let i = 0; i < 20; i++) {
    const wallet = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
    jeets.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        radius: 20 + (wallet / 1000000) * 30,
        speed: 1,
        angle: Math.random() * Math.PI * 2,
        image: jeetImage,
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
        image: jeetImage,
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

const rugs = [];
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

socket.on('init-players', (serverPlayers) => {
    players = serverPlayers;
});

socket.on('update-players', (serverPlayers) => {
    players = serverPlayers;
});

if (!startButton) {
    console.error("Start button not found! Check if 'startButton' ID exists in your HTML.");
} else {
    startButton.disabled = false;

    socket.on('connect', () => {
        console.log("Socket.io connected, ID:", socket.id);
    });

    socket.on('connect_error', (error) => {
        console.error("Socket.io connection error:", error);
    });

    startButton.addEventListener("click", () => {
        let name = coinNameInput ? coinNameInput.value.trim() : "";
        if (!name) {
            const randomIndex = Math.floor(Math.random() * memecoinNames.length);
            name = memecoinNames[randomIndex];
            if (coinNameInput) coinNameInput.value = name;
        }
        player.name = name;

        if (coinImageInput && coinImageInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    player.image = img;
                    startGame();
                };
                img.onerror = () => {
                    startGame();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(coinImageInput.files[0]);
        } else {
            const randomIndex = Math.floor(Math.random() * memecoinEmojis.length);
            player.name += ` ${memecoinEmojis[randomIndex]}`;
            startGame();
        }
    });
}

function startGame() {
    if (!startScreen) return;
    startScreen.style.display = "none";
    gameStarted = true;
    player.id = socket.id || "temp-" + Math.random().toString(36).substr(2, 9);
    requestAnimationFrame(gameLoop);
}

window.addEventListener("mousemove", (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
});

window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !player.boostCooldown && player.stamina > 0) {
        boostActive = true;
        boostTimer = 900;
    }
});

window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
        boostActive = false;
    }
});

function createExplosion(x, y, radius) {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        const size = Math.random() * 5 + 2;
        const color = `hsl(${Math.random() * 30 + 10}, 100%, 50%)`;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: size,
            color: color,
            life: 60,
        });
    }
}

function createConfetti() {
    const confettiCount = 100;
    for (let i = 0; i < confettiCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        const size = Math.random() * 5 + 2;
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        particles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: size,
            color: color,
            life: 60,
            type: "confetti",
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.type === "confetti") {
            p.vy += 0.1;
            p.vx *= 0.99;
            p.size *= 0.98;
        } else {
            p.size *= 0.95;
        }
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.fillStyle = p.color;
        if (p.type === "confetti") {
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function moveDots() {
    for (let dot of dots) {
        const dx = player.x - dot.x;
        const dy = player.y - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pullSpeed = 2;

        if (dot.type.emoji === "🐛" && player.marketcap < 100000) {
            if (dist < 500) {
                dot.x += (dx / dist) * pullSpeed;
                dot.y += (dy / dist) * pullSpeed;
            }
        } else if (dot.type.emoji === "🐟" && player.marketcap >= 200000) {
            if (dist < 500) {
                dot.x += (dx / dist) * pullSpeed;
                dot.y += (dy / dist) * pullSpeed;
            }
        } else if ((dot.type.emoji === "🐋" || dot.type.emoji === "🦈") && player.marketcap < 500000) {
            if (dist < 500) {
                dot.x -= (dx / dist) * dot.type.speed * 2;
                dot.y -= (dy / dist) * dot.type.speed * 2;
            } else {
                dot.angle += (Math.random() - 0.5) * 0.3;
                dot.x += Math.cos(dot.angle) * dot.type.speed;
                dot.y += Math.sin(dot.angle) * dot.type.speed;
            }
        } else {
            if (dist < 100) {
                dot.x += (dx / dist) * pullSpeed;
                dot.y += (dy / dist) * pullSpeed;
            } else {
                dot.angle += (Math.random() - 0.5) * 0.3;
                dot.x += Math.cos(dot.angle) * dot.type.speed;
                dot.y += Math.sin(dot.angle) * dot.type.speed;
            }
        }

        if (dot.x < 0 || dot.x > mapWidth) dot.angle = Math.PI - dot.angle;
        if (dot.y < 0 || dot.y > mapHeight) dot.angle = -dot.angle;
    }
}

function moveJeets() {
    for (let i = 0; i < jeets.length; i++) {
        let jeet = jeets[i];
        updateRadius(jeet);
        if (jeet.attached) {
            jeet.orbitAngle += 0.05;
            const orbitRadius = player.radius + jeet.radius + 10;
            jeet.x = player.x + Math.cos(jeet.orbitAngle) * orbitRadius;
            jeet.y = player.y + Math.sin(jeet.orbitAngle) * orbitRadius;

            jeet.attachTimer--;
            if (jeet.attachTimer <= 0) {
                jeet.attached = false;
                jeet.flame = true;
                jeet.flameTimer = 120;
                jeet.shakeTimer = 30;
                player.shakeTimer = 30;
                const stolenAmount = jeet.wallet;
                player.marketcap -= stolenAmount;
                if (player.marketcap <= 0) {
                    player.marketcap = 0;
                    gameOver = true;
                    gameStarted = false;
                    showGameOver();
                }
                updateRadius(player);
                createExplosion(jeet.x, jeet.y, jeet.radius);
                const edgeAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
                jeet.angle = edgeAngles[Math.floor(Math.random() * edgeAngles.length)];
            }
            continue;
        }

        const dx = player.x - jeet.x;
        const dy = player.y - jeet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
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
        } else if (dist < 2000 && player.marketcap >= jeet.wallet) {
            if (!jeet.angry) {
                jeet.angry = true;
                jeet.angryTimer = 900;
            }
            if (jeet.angry) {
                jeet.image = jeetAngryImage;
                jeetSpeed *= 2;
                jeet.angle = Math.atan2(dy, dx);
                jeet.angryTimer--;
                if (jeet.angryTimer <= 0) {
                    jeet.angry = false;
                    jeet.image = jeetImage;
                }
            }
        } else {
            jeet.angry = false;
            jeet.image = jeetImage;
            jeet.angle += (Math.random() - 0.5) * 0.3;
        }

        jeet.x += Math.cos(jeet.angle) * jeetSpeed;
        jeet.y += Math.sin(jeet.angle) * jeetSpeed;
        if (jeet.x < 0 || jeet.x > mapWidth) jeet.angle = Math.PI - jeet.angle;
        if (jeet.y < 0 || jeet.y > mapHeight) jeet.angle = -jeet.angle;

        if (jeet.shakeTimer > 0) jeet.shakeTimer--;
    }
}

function drawBackground(viewX, viewY, viewWidth, viewHeight) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(viewX, viewY, viewWidth, viewHeight);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    for (let x = Math.floor(viewX / 200) * 200; x <= viewX + viewWidth; x += 200) {
        ctx.beginPath();
        ctx.moveTo(x, viewY);
        ctx.lineTo(x, viewY + viewHeight);
        ctx.stroke();
    }
    for (let y = Math.floor(viewY / 200) * 200; y <= viewY + viewHeight; y += 200) {
        ctx.beginPath();
        ctx.moveTo(viewX, y);
        ctx.lineTo(viewX + viewWidth, y);
        ctx.stroke();
    }
}

function drawDots(viewX, viewY, viewWidth, viewHeight) {
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    for (let dot of dots) {
        if (dot.x > viewX - 50 && dot.x < viewX + viewWidth + 50 && dot.y > viewY - 50 && dot.y < viewY + viewHeight + 50) {
            ctx.fillStyle = dot.type.color;
            ctx.fillText(dot.type.emoji, dot.x, dot.y);
        }
    }
}

function drawJeets(viewX, viewY, viewWidth, viewHeight) {
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    for (let jeet of jeets) {
        if (jeet.x > viewX - 100 && jeet.x < viewX + viewWidth + 100 && jeet.y > viewY - 100 && jeet.y < viewY + viewHeight + 100) {
            ctx.save();
            ctx.globalAlpha = jeet.opacity;
            ctx.beginPath();
            const shakeOffset = jeet.shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;
            ctx.arc(jeet.x + shakeOffset, jeet.y + shakeOffset, jeet.radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(jeet.image, jeet.x - jeet.radius + shakeOffset, jeet.y - jeet.radius + shakeOffset, jeet.radius * 2, jeet.radius * 2);
            ctx.restore();

            if (jeet.flame) {
                ctx.save();
                ctx.globalAlpha = jeet.opacity;
                ctx.fillStyle = "orange";
                ctx.beginPath();
                ctx.moveTo(jeet.x - jeet.radius + shakeOffset, jeet.y + shakeOffset);
                ctx.lineTo(jeet.x - jeet.radius - 20 + shakeOffset, jeet.y - 10 + shakeOffset);
                ctx.lineTo(jeet.x - jeet.radius - 20 + shakeOffset, jeet.y + 10 + shakeOffset);
                ctx.fill();
                ctx.restore();
            }

            ctx.save();
            ctx.globalAlpha = jeet.opacity;
            ctx.fillStyle = jeet.angry ? "orange" : "red";
            ctx.fillText(jeet.angry ? "ANGRY JEET" : "JEET", jeet.x + shakeOffset, jeet.y - jeet.radius - 10 + shakeOffset);
            ctx.fillStyle = "white";
            ctx.fillText(`$${formatMarketCap(jeet.wallet)}`, jeet.x + shakeOffset, jeet.y + jeet.radius + 15 + shakeOffset);
            ctx.restore();
        }
    }
}

function drawRugs(viewX, viewY, viewWidth, viewHeight) {
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    for (let rug of rugs) {
        if (rug.active && rug.x > viewX && rug.x < viewX + viewWidth && rug.y > viewY && rug.y < viewY + viewHeight) {
            ctx.fillStyle = "purple";
            ctx.fillText("💸 RUG", rug.x, rug.y);
        }
    }
}

function drawBusinesses(viewX, viewY, viewWidth, viewHeight) {
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    for (let business of businesses) {
        if (business.x > viewX && business.x < viewX + viewWidth && business.y > viewY && business.y < viewY + viewHeight) {
            ctx.fillStyle = business.color;
            ctx.fillText("🏦", business.x, business.y);
        }
    }
}

function generateRandomAddress() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let address = "";
    for (let i = 0; i < 6; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
}

function normalizeHolderPercentages() {
    const totalPercentage = player.holders.reduce((sum, holder) => sum + holder.percentage, 0);
    if (totalPercentage > 100) {
        const scale = 100 / totalPercentage;
        player.holders.forEach(holder => {
            holder.percentage = (holder.percentage * scale).toFixed(2);
        });
    }
}

function checkCollisions() {
    for (let i = dots.length - 1; i >= 0; i--) {
        const dx = player.x - dots[i].x;
        const dy = player.y - dots[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.radius + dots[i].type.size) {
            player.marketcap += dots[i].wallet;
            player.speed = Math.min(player.speed + 0.05, player.maxSpeed);
            updateRadius(player);

            const holderAddress = generateRandomAddress();
            const percentage = (Math.random() * 4.9 + 0.1).toFixed(2);
            player.allHolders.push({ address: holderAddress, percentage: parseFloat(percentage) });
            player.holders = [...player.allHolders];
            player.holders.sort((a, b) => b.percentage - a.percentage);
            if (player.holders.length > 20) {
                player.holders = player.holders.slice(0, 20);
            }

            normalizeHolderPercentages();

            dots.splice(i, 1);
        }
    }
}

function checkJeetCollisions() {
    const attachedJeets = jeets.filter(jeet => jeet.attached).length;
    for (let jeet of jeets) {
        if (jeet.attached || jeet.flame) continue;
        const dx = player.x - jeet.x;
        const dy = player.y - jeet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.radius + jeet.radius && player.marketcap >= jeet.wallet && attachedJeets < 2) {
            jeet.attached = true;
            jeet.orbitAngle = Math.random() * Math.PI * 2;
            const attachDurations = [180, 300, 420, 600, 780];
            jeet.attachTimer = attachDurations[Math.floor(Math.random() * attachDurations.length)];
        }
    }
}

function checkRugCollisions() {
    for (let rug of rugs) {
        if (!rug.active) continue;
        const dx = player.x - rug.x;
        const dy = player.y - rug.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.radius + rug.radius) {
            player.marketcap *= 0.5;
            if (player.marketcap <= 0) {
                player.marketcap = 0;
                gameOver = true;
                gameStarted = false;
                showGameOver();
            }
            updateRadius(player);
            rug.active = false;
            setTimeout(() => (rug.active = true), 30000);
        }
    }
}

function checkBusinessCollisions() {
    for (let business of businesses) {
        const dx = player.x - business.x;
        const dy = player.y - business.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.radius + business.radius) {
            player.marketcap += business.income;
            updateRadius(player);

            socket.emit('update-player', {
                id: player.id,
                x: player.x,
                y: player.y,
                marketcap: player.marketcap,
                name: player.name,
                image: player.image ? player.image.src : null,
                radius: player.radius,
                color: player.color,
                speed: player.speed
            });
        }
    }
}

function checkPlayerCollisions() {
    for (let i = players.length - 1; i >= 0; i--) {
        const otherPlayer = players[i];
        if (otherPlayer.id === player.id) continue;

        const dx = player.x - otherPlayer.x;
        const dy = player.y - otherPlayer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.radius + otherPlayer.radius) {
            if (player.radius > otherPlayer.radius) {
                player.marketcap += otherPlayer.marketcap;
                updateRadius(player);

                socket.emit('player-rugged', otherPlayer.id);

                socket.emit('update-player', {
                    id: player.id,
                    x: player.x,
                    y: player.y,
                    marketcap: player.marketcap,
                    name: player.name,
                    image: player.image ? player.image.src : null,
                    radius: player.radius,
                    color: player.color,
                    speed: player.speed
                });
            }
        }
    }
}

function checkFOMO() {
    const leader = players[0];
    if (!leader || leader.id === player.id) return;
    const dx = player.x - leader.x;
    const dy = player.y - leader.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 500) {
        player.marketcap += 100;
        updateRadius(player);
        ctx.fillStyle = "yellow";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("FOMO!", player.x, player.y - player.radius - 30);
    }
}

function drawPlayer(p, worldMouseX, worldMouseY) {
    const angleToMouse = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
    p.slimeDeform += 0.1;
    const numPoints = p.slimePoints.length;
    const spring = 0.1;
    const friction = 0.85;

    for (let i = 0; i < numPoints; i++) {
        const point = p.slimePoints[i];
        const angle = (i / numPoints) * Math.PI * 2;
        let radiusOffset = Math.sin(p.slimeDeform + angle * 3) * 5;
        const mouseInfluence = Math.cos(angle - angleToMouse);
        radiusOffset += mouseInfluence * 30;
        const targetRadius = p.radius + radiusOffset;
        point.targetX = p.x + Math.cos(angle) * targetRadius;
        point.targetY = p.y + Math.sin(angle) * targetRadius;
        const dx = point.targetX - point.x;
        const dy = point.targetY - point.y;
        point.vx += dx * spring;
        point.vy += dy * spring;
        point.vx *= friction;
        point.vy *= friction;
        point.x += point.vx;
        point.y += point.vy;
    }

    ctx.beginPath();
    const shakeOffset = p.shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;
    ctx.moveTo(p.slimePoints[0].x + shakeOffset, p.slimePoints[0].y + shakeOffset);

    for (let i = 1; i < p.slimePoints.length; i++) {
        const prev = p.slimePoints[i - 1];
        const curr = p.slimePoints[i];
        const next = p.slimePoints[(i + 1) % p.slimePoints.length];
        const xc = (curr.x + prev.x) / 2;
        const yc = (curr.y + prev.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, xc, yc);
    }

    ctx.closePath();
    ctx.shadowColor = "rgba(0, 255, 0, 0.7)";
    ctx.shadowBlur = 15;

    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
    gradient.addColorStop(0, "rgba(51, 255, 51, 0.9)");
    gradient.addColorStop(1, "rgba(0, 153, 0, 0.5)");
    ctx.fillStyle = gradient;
    ctx.fill();

    if (p.image) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(p.image, p.x - p.radius + shakeOffset, p.y - p.radius + shakeOffset, p.radius * 2, p.radius * 2);
        ctx.restore();
    }

    ctx.strokeStyle = "lime";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x + shakeOffset, p.y - p.radius - 15 + shakeOffset);
    ctx.font = "12px Arial";
    ctx.fillText(`$${formatMarketCap(p.marketcap)}`, p.x + shakeOffset, p.y + p.radius + 20 + shakeOffset);
    ctx.fillText(`Holders: ${player.allHolders.length}`, p.x + shakeOffset, p.y + p.radius + 35 + shakeOffset);
}

function drawOtherPlayers(viewX, viewY, viewWidth, viewHeight) {
    for (let p of players) {
        if (p.id === player.id) continue;
        if (p.x > viewX - 100 && p.x < viewX + viewWidth + 100 && p.y > viewY - 100 && p.y < viewY + viewHeight + 100) {
            if (p.image) {
                const img = new Image();
                img.src = p.image;
                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
                ctx.restore();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.strokeStyle = "lime";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "white";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(p.name, p.x, p.y - p.radius - 15);

            ctx.font = "12px Arial";
            ctx.fillText(`$${formatMarketCap(p.marketcap)}`, p.x, p.y + p.radius + 20);
        }
    }
}

function formatMarketCap(marketcap) {
    if (marketcap >= 1_000_000) return (marketcap / 1_000_000).toFixed(1) + "M";
    if (marketcap >= 1_000) return (marketcap / 1_000).toFixed(1) + "K";
    return marketcap.toFixed(2);
}

function drawLeaderboard() {
    const leaderboard = document.getElementById("leaderboard");
    if (leaderboard) {
        leaderboard.innerHTML = "Top Coins:<br>";
        players.sort((a, b) => b.marketcap - a.marketcap);
        for (let i = 0; i < Math.min(players.length, 5); i++) {
            const p = players[i];
            leaderboard.innerHTML += `${i + 1}. ${p.name} ($${formatMarketCap(p.marketcap)})<br>`;
        }
    }
}

function updateCoinInfo() {
    const coinNameElement = document.getElementById("coinName");
    if (coinNameElement) {
        coinNameElement.innerText = player.name;
    }

    const topHoldersElement = document.getElementById("topHolders");
    if (topHoldersElement) {
        topHoldersElement.innerHTML = "";
        player.holders.forEach((holder, index) => {
            topHoldersElement.innerHTML += `${index + 1}. ${holder.address} - ${holder.percentage}%<br>`;
        });
    }

    const bondingCurvePercentageElement = document.getElementById("bondingCurvePercentage");
    const bondingCurveFillElement = document.getElementById("bondingCurveFill");
    if (bondingCurvePercentageElement && bondingCurveFillElement) {
        const maxMarketCap = 100000;
        const percentage = Math.min((player.marketcap / maxMarketCap) * 100, 100);
        bondingCurvePercentageElement.innerText = `${percentage.toFixed(1)}%`;
        bondingCurveFillElement.style.width = `${percentage}%`;

        if (percentage >= 100 && !player.hasBonded) {
            player.hasBonded = true;
            createConfetti();
        }
    }
}

function drawMinimap() {
    const miniWidth = 200;
    const miniHeight = 200;
    ctx.fillStyle = "#111";
    ctx.fillRect(canvas.width - miniWidth - 10, canvas.height - miniHeight - 10, miniWidth, miniHeight);
    ctx.strokeStyle = "#555";
    ctx.strokeRect(canvas.width - miniWidth - 10, canvas.height - miniHeight - 10, miniWidth, miniHeight);
    for (let p of players) {
        const miniX = (p.x / mapWidth) * miniWidth + canvas.width - miniWidth - 10;
        const miniY = (p.y / mapHeight) * miniHeight + canvas.height - miniHeight - 10;
        ctx.fillStyle = p.id === player.id ? "lime" : "red";
        ctx.beginPath();
        ctx.arc(miniX, miniY, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawStaminaBar() {
    ctx.fillStyle = "grey";
    ctx.fillRect(10, canvas.height - 30, 100, 20);
    ctx.fillStyle = player.stamina > 0 ? "lime" : "red";
    ctx.fillRect(10, canvas.height - 30, player.stamina, 20);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText("SPACE FOR BOOST", 120, canvas.height - 15);
}

function drawTrail() {
    for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,0,${t.opacity})`;
        ctx.fill();
        t.opacity -= 0.01;
        if (t.opacity <= 0) {
            trail.splice(i, 1);
            i--;
        }
    }
}

function showGameOver() {
    canvas.classList.add("flash-red");

    failedText.style.animation = "fadeInOut 3s forwards";

    setTimeout(() => {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        startScreen.style.display = "block";
        gameOver = false;
        gameStarted = false;

        player.marketcap = 1000;
        player.speed = 2;
        player.x = mapWidth / 2;
        player.y = mapHeight / 2;
        player.stamina = 100;
        player.boostCooldown = false;
        player.allHolders = [];
        player.holders = [];
        player.hasBonded = false;
        updateRadius(player);
        jeets = [];
        for (let i = 0; i < 20; i++) {
            const wallet = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
            jeets.push({
                x: Math.random() * mapWidth,
                y: Math.random() * mapHeight,
                radius: 20 + (wallet / 1000000) * 30,
                speed: 1,
                angle: Math.random() * Math.PI * 2,
                image: jeetImage,
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
        canvas.classList.remove("flash-red");
        failedText.style.animation = "none";
        failedText.style.opacity = 0;
        restartText.style.opacity = 0;
    }, 3000);
}

function gameLoop() {
    if (!gameStarted) return;

    try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let targetZoom = 100 / player.radius;
        targetZoom = Math.max(0.1, Math.min(1, targetZoom));
        player.zoom += (targetZoom - player.zoom) * 0.05;

        const viewX = player.x - (canvas.width / 2) / player.zoom;
        const viewY = player.y - (canvas.height / 2) / player.zoom;
        const viewWidth = canvas.width / player.zoom;
        const viewHeight = canvas.height / player.zoom;

        const worldMouseX = player.x + (target.x - canvas.width / 2) / player.zoom;
        const worldMouseY = player.y + (target.y - canvas.height / 2) / player.zoom;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(player.zoom, player.zoom);
        ctx.translate(-player.x, -player.y);

        drawBackground(viewX, viewY, viewWidth, viewHeight);

        const angle = Math.atan2(target.y - canvas.height / 2, target.x - canvas.width / 2);
        const moveSpeed = boostActive ? player.speed * 2 : player.speed;
        player.x += Math.cos(angle) * moveSpeed * 0.5;
        player.y += Math.sin(angle) * moveSpeed * 0.5;
        player.x = Math.max(player.radius, Math.min(mapWidth - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(mapHeight - player.radius, player.y));

        if (boostActive && boostTimer > 0 && player.stamina > 0) {
            player.stamina -= 100 / 900;
            boostTimer--;
            trail.push({ x: player.x, y: player.y, radius: 5, opacity: 0.5 });
            if (player.stamina <= 0) {
                boostActive = false;
                boostTimer = 0;
                player.boostCooldown = true;
            }
        } else {
            boostActive = false;
            boostTimer = 0;
            if (!player.boostCooldown) {
                player.stamina = Math.min(player.stamina + 0.1, player.maxStamina);
            } else if (player.stamina < player.maxStamina) {
                player.stamina += 0.1;
                if (player.stamina >= player.maxStamina) {
                    player.boostCooldown = false;
                }
            }
        }

        if (player.shakeTimer > 0) player.shakeTimer--;

        moveDots();
        moveJeets();
        checkCollisions();
        checkJeetCollisions();
        checkRugCollisions();
        checkFOMO();
        checkPlayerCollisions();
        checkBusinessCollisions();
        updateParticles();
        drawDots(viewX, viewY, viewWidth, viewHeight);
        drawJeets(viewX, viewY, viewWidth, viewHeight);
        drawRugs(viewX, viewY, viewWidth, viewHeight);
        drawBusinesses(viewX, viewY, viewWidth, viewHeight);
        drawTrail();
        drawPlayer(player, worldMouseX, worldMouseY);
        drawOtherPlayers(viewX, viewY, viewWidth, viewHeight);
        drawParticles();

        ctx.restore();

        drawMinimap();
        drawLeaderboard();
        updateCoinInfo();
        drawStaminaBar();

        socket.emit('update-player', {
            id: player.id,
            x: player.x,
            y: player.y,
            marketcap: player.marketcap,
            name: player.name,
            image: player.image ? player.image.src : null,
            radius: player.radius,
            color: player.color,
            speed: player.speed
        });

        requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error("Error in game loop:", error);
    }
}
