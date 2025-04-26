const startScreen = document.getElementById("startScreen");
const coinNameInput = document.getElementById("coinName");
const coinImageInput = document.getElementById("coinImage");
const startButton = document.getElementById("startButton");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Socket.io bağlantısını kur
const socket = io();

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const mapWidth = 1000; // MAP KÜÇÜLTELECEK: 15000 yerine 1000
const mapHeight = 1000; // MAP KÜÇÜLTELECEK: 15000 yerine 1000

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
    speed: 2, // Başlangıç hızı
    image: null,
    zoom: 1,
    stamina: 100,
    maxStamina: 100,
    shakeTimer: 0,
    boostCooldown: false,
};

// Oyuncunun başlangıç radius değerini marketcap'e göre güncelle
updateRadius(player);

// Tüm oyuncuların listesi (sunucudan alınacak)
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

for (let i = 0; i < 1000; i++) { // 20000 yerine 1000 (harita küçüldüğü için orantılı olarak azalttık)
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

// JEET düşmanları
const jeetImage = new Image();
jeetImage.src = "jeet.png";
const jeetAngryImage = new Image();
jeetAngryImage.src = "jeet_angry.png";

let jeets = [];
for (let i = 0; i < 20; i++) { // 100 yerine 20 (harita küçüldüğü için orantılı olarak azalttık)
    const wallet = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
    jeets.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        radius: 20 + (wallet / 1000000) * 30,
        speed: 1,
        angle: Math.random() * Math.PI * 2,
        image: jeetImage,
        angry: false,
        angryTimer: 0, // Yeni: Kovalama süresi için timer
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
        angryTimer: 0, // Yeni: Kovalama süresi için timer
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

// RUG tuzakları
const rugs = [];
for (let i = 0; i < 5; i++) { // 50 yerine 5 (harita küçüldüğü için orantılı olarak azalttık)
    rugs.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        radius: 20,
        active: Math.random() > 0.5,
    });
}

// İşletmeler (İŞLETMELERDEN KAZANILABİLECEK)
let businesses = [
    { x: 200, y: 200, radius: 20, color: 'green', income: 50 },
    { x: 800, y: 800, radius: 20, color: 'green', income: 50 }
];

// Sunucudan gelen oyuncuları al
socket.on('init-players', (serverPlayers) => {
    players = serverPlayers;
});

socket.on('update-players', (serverPlayers) => {
    players = serverPlayers;
});

// Socket bağlantısı tamamlanana kadar butonu devre dışı bırak
startButton.disabled = true;

socket.on('connect', () => {
    console.log("Socket.io connected, ID:", socket.id);
    startButton.disabled = false; // Bağlantı tamamlandığında butonu aktif et
});

socket.on('connect_error', (error) => {
    console.error("Socket.io connection error:", error);
});

if (!startButton) {
    console.error("Start button not found! Check if 'startButton' ID exists in your HTML.");
}
startButton.addEventListener("click", () => {
    console.log("Start button clicked!");

    let name = coinNameInput.value.trim();
    if (!name) {
        const randomIndex = Math.floor(Math.random() * memecoinNames.length);
        name = memecoinNames[randomIndex];
        coinNameInput.value = name;
    }
    player.name = name;
    console.log("Player name set to:", player.name);

    if (coinImageInput.files.length > 0) {
        console.log("Image selected, loading...");
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                console.log("Image loaded successfully!");
                player.image = img;
                startScreen.style.display = "none";
                gameStarted = true;
                player.id = socket.id || "temp-" + Math.random().toString(36).substr(2, 9);
                console.log("Game started, player ID:", player.id);
                requestAnimationFrame(gameLoop);
            };
            img.onerror = () => {
                console.error("Player image failed to load!");
                startScreen.style.display = "none";
                gameStarted = true;
                player.id = socket.id || "temp-" + Math.random().toString(36).substr(2, 9);
                console.log("Game started (image failed), player ID:", player.id);
                requestAnimationFrame(gameLoop);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(coinImageInput.files[0]);
    } else {
        console.log("No image selected, using emoji...");
        const randomIndex = Math.floor(Math.random() * memecoinEmojis.length);
        player.name += ` ${memecoinEmojis[randomIndex]}`;
        startScreen.style.display = "none";
        gameStarted = true;
        player.id = socket.id || "temp-" + Math.random().toString(36).substr(2, 9);
        console.log("Game started (no image), player ID:", player.id);
        requestAnimationFrame(gameLoop);
    }
});

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

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.size *= 0.95;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function updateRadius(entity) {
    const baseRadius = 20;
    const divisor = 1000000;
    const multiplier = 30;
    entity.radius = baseRadius + (entity.marketcap || entity.wallet) / divisor * multiplier;
    entity.radius = Math.max(20, Math.min(100, entity.radius));
    console.log(`Updated radius for ${entity.name || 'JEET'}: ${entity.radius}, Marketcap/Wallet: ${entity.marketcap || entity.wallet}`);
}

function moveDots() {
    for (let dot of dots) {
        const dx = player.x - dot.x;
        const dy = player.y - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
            const pullSpeed = 2;
            dot.x += (dx / dist) * pullSpeed;
            dot.y += (dy / dist) * pullSpeed;
        } else {
            dot.angle += (Math.random() - 0.5) * 0.3;
            dot.x += Math.cos(dot.angle) * dot.type.speed;
            dot.y += Math.sin(dot.angle) * dot.type.speed;
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
                updateRadius(player);
                if (player.marketcap < 0) {
                    gameOver = true;
                    gameStarted = false;
                    showGameOver();
                }
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
                jeet.angryTimer = 300; // 5 saniye (60 FPS'de 300 frame)
            }
            if (jeet.angry) {
                jeet.image = jeetAngryImage;
                jeetSpeed *= 2;
                jeet.angle = Math.atan2(dy, dx);
                jeet.angryTimer--;
                if (jeet.angryTimer <= 0) {
                    jeet.angry = false; // 5 saniye sonra kovalamayı bırak
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

function checkCollisions() {
    for (let i = dots.length - 1; i >= 0; i--) {
        const dx = player.x - dots[i].x;
        const dy = player.y - dots[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.radius + dots[i].type.size) {
            player.marketcap += dots[i].wallet;
            player.speed += 0.05; // Yeni: Yem yedikçe hız artar
            updateRadius(player);
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
            updateRadius(player);
            if (player.marketcap < 0) {
                gameOver = true;
                gameStarted = false;
                showGameOver();
            }
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
            player.marketcap += business.income; // İşletmeden gelir
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
                // Büyük oyuncu, küçük oyuncunun tüm marketcap'ini alır
                player.marketcap += otherPlayer.marketcap;
                updateRadius(player);

                // Küçük oyuncuyu kaldır (rug pull)
                socket.emit('player-rugged', otherPlayer.id);

                // Kendi bilgilerini güncelle
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

function drawPlayer(p) {
    if (p.image) {
        ctx.save();
        ctx.beginPath();
        const shakeOffset = p.shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;
        ctx.arc(p.x + shakeOffset, p.y + shakeOffset, p.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(p.image, p.x - p.radius + shakeOffset, p.y - p.radius + shakeOffset, p.radius * 2, p.radius * 2);
        ctx.restore();
    } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const shakeOffset = p.shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;
        ctx.arc(p.x + shakeOffset, p.y + shakeOffset, p.radius, 0, Math.PI * 2);
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

function drawOtherPlayers(viewX, viewY, viewWidth, viewHeight) {
    for (let p of players) {
        if (p.id === player.id) continue; // Kendi oyuncumuzu çizme
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
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "red";
    ctx.font = "50px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("Your Market Cap Dropped Below Zero!", canvas.width / 2, canvas.height / 2);
    ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 50);

    window.addEventListener("keydown", restartGame);
}

function restartGame(e) {
    if (e.code === "KeyR" && gameOver) {
        gameOver = false;
        gameStarted = true;
        player.marketcap = 1000;
        player.speed = 2; // Hızı sıfırla
        player.x = mapWidth / 2;
        player.y = mapHeight / 2;
        player.stamina = 100;
        player.boostCooldown = false;
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
        window.removeEventListener("keydown", restartGame);
        requestAnimationFrame(gameLoop);
    }
}

function gameLoop() {
    if (!gameStarted) return;

    try {
        console.log("Game loop running...");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let targetZoom = 100 / player.radius;
        targetZoom = Math.max(0.1, Math.min(1, targetZoom));
        player.zoom += (targetZoom - player.zoom) * 0.05;

        const viewX = player.x - (canvas.width / 2) / player.zoom;
        const viewY = player.y - (canvas.height / 2) / player.zoom;
        const viewWidth = canvas.width / player.zoom;
        const viewHeight = canvas.height / player.zoom;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(player.zoom, player.zoom);
        ctx.translate(-player.x, -player.y);

        drawBackground(viewX, viewY, viewWidth, viewHeight);

        const angle = Math.atan2(target.y - canvas.height / 2, target.x - canvas.width / 2);
        const moveSpeed = boostActive ? player.speed * 3 : player.speed;
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
        drawPlayer(player);
        drawOtherPlayers(viewX, viewY, viewWidth, viewHeight);
        drawParticles();

        ctx.restore();

        drawMinimap();
        drawLeaderboard();
        drawStaminaBar();

        // Oyuncunun güncel verilerini sunucuya gönder
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
