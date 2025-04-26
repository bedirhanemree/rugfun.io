const express = require('express');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// İstemci dosyalarını sun (client klasöründen)
app.use(express.static(path.join(__dirname, '../client')));

// Bağlı oyuncuların bilgilerini tutacak dizi
let players = [];

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  // Yeni oyuncu bağlandığında, mevcut oyuncuları gönder
  socket.emit('init-players', players);

  // Oyuncudan gelen verileri al
  socket.on('update-player', (playerData) => {
    // Oyuncuyu güncelle veya ekle
    const index = players.findIndex(p => p.id === playerData.id);
    if (index !== -1) {
      players[index] = playerData;
    } else {
      players.push(playerData);
    }
    // Tüm oyunculara güncellenmiş oyuncu listesini gönder
    io.emit('update-players', players);
  });

  // Oyuncu bağlantısı kesildiğinde
  socket.on('disconnect', () => {
    console.log('A player disconnected:', socket.id);
    // Oyuncuyu listeden kaldır
    players = players.filter(p => p.id !== socket.id);
    // Güncellenmiş listeyi diğer oyunculara gönder
    io.emit('update-players', players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});