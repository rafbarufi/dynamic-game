const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let walls = [];

let questionActive = false; // Flag para impedir perguntas repetidas
let gamePaused = false; // Flag para pausar o loop quando a aba não estiver visível
let animationFrameId = null; // Para controlar o requestAnimationFrame

canvas.width = 800;
canvas.height = 608;

// Carregar mapa
const mapImage = new Image();
mapImage.src = "./Mapa1.png"; // Seu mapa base

// Carregar imagens do personagem
const playerImages = {
  up: new Image(),
  down: new Image(),
  left: new Image(),
  right: new Image(),
};

// Variável global para armazenar o gradiente atual
let cachedGradient = null;
let lastPlayerPos = { x: null, y: null };

playerImages.up.src = "./character/up.png";
playerImages.down.src = "./character/down.png";
playerImages.left.src = "./character/left.png";
playerImages.right.src = "./character/right.png";

// Posição inicial do jogador
let player = {
  x: 180,
  y: 576,
  width: 32,
  height: 32,
  speed: 2,
  image: playerImages.up,
};

let monsterQuestions = [];

async function loadMonsterQuestions() {
  const response = await fetch("monsterQuestions.json");
  const data = await response.json();
  monsterQuestions = data.monstros; // Armazena o array de perguntas
}

let monsterImage = new Image();
monsterImage.src = "./monsters_layer.png"; // Certifique-se que o arquivo correto está carregado

monsterImage.onload = function () {
  console.log("Imagem dos monstros carregada com sucesso!");
};

monsterImage.onerror = function () {
  console.error("Erro ao carregar a imagem dos monstros! Verifique o caminho.");
};

let monsters = [];

let helperDialogs = [];

async function loadHelperDialogs() {
  const response = await fetch("helpersDialogs.json");
  const data = await response.json();
  helperDialogs = data.helpers; // Armazena o array de ajudas
}

let helperImage = new Image();
helperImage.src = "./helpers_layer.png"; // Certifique-se que o arquivo correto está carregado

helperImage.onload = function () {
  console.log("Imagem dos monstros carregada com sucesso!");
};

helperImage.onerror = function () {
  console.error("Erro ao carregar a imagem dos monstros! Verifique o caminho.");
};

let helpers = [];

// Atualiza a posição com base nas teclas pressionadas
let keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  updatePlayerDirection(e.key);
  // Se o jogo estiver pausado (aba fora de foco) e a aba estiver visível, retoma com uma tecla
  if (gamePaused && document.visibilityState === "visible") {
    console.log("despausou");
    gamePaused = false;
    gameLoop();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
  updatePlayerDirection();
});

function update() {
  if (questionActive || gamePaused) {
    return;
  }
  let nextX = player.x;
  let nextY = player.y;

  if (keys["ArrowUp"]) nextY -= player.speed;
  if (keys["ArrowDown"]) nextY += player.speed;
  if (keys["ArrowLeft"]) nextX -= player.speed;
  if (keys["ArrowRight"]) nextX += player.speed;

  if (
    nextX > 0 &&
    nextX + player.width < canvas.width &&
    !isColliding(nextX, nextY)
  ) {
    player.x = nextX;
  }
  if (
    nextY > 0 &&
    nextY + player.height < canvas.height &&
    !isColliding(nextX, nextY)
  ) {
    player.y = nextY;
  }

  // Verifica se o jogador atingiu o ponto de conclusão do jogo
  if (player.y <= 32 && player.x >= 144 && player.x <= 176) {
    completeGame();
    return;
  }

  // Processa a animação de fade-out dos monstros derrotados
  for (let i = monsters.length - 1; i >= 0; i--) {
    let monster = monsters[i];
    if (monster.dying) {
      monster.opacity -= 0.05; // Ajuste o delta para controlar a velocidade do fade
      if (monster.opacity <= 0) {
        monsters.splice(i, 1); // Remove o monstro quando a opacidade chegar a 0
      }
    }
  }

  // Verifica colisão com monstros (somente os que não estão em fade-out)
  for (let i = 0; i < monsters.length; i++) {
    let monster = monsters[i];
    if (!monster.dying && isCollidingWithMonster(nextX, nextY, monster)) {
      if (!questionActive) {
        questionActive = true;
        askQuestion(monster, i);
      }
      return;
    }
  }

  // Verifica colisão com ajudantes
  for (let i = 0; i < helpers.length; i++) {
    let helper = helpers[i];
    if (isCollidingWithMonster(nextX, nextY, helper)) {
      // Reutiliza a mesma função de colisão
      if (!questionActive) {
        questionActive = true;
        askHelper(helper, i);
      }
      return;
    }
  }
}

function isColliding(nextX, nextY) {
  const tolerance = 12;
  const pRight = nextX + player.width;
  const pBottom = nextY + player.height;
  for (let wall of walls) {
    if (
      pRight - tolerance > wall.x &&
      nextX + tolerance < wall.x + wall.width &&
      pBottom - tolerance > wall.y &&
      nextY + tolerance < wall.y + wall.height
    ) {
      return true;
    }
  }
  return false;
}

function isCollidingWithMonster(nextX, nextY, monster) {
  return (
    nextX < monster.x + monster.width &&
    nextX + player.width > monster.x &&
    nextY < monster.y + monster.height &&
    nextY + player.height > monster.y
  );
}

let lastQuestionTime = 0; // Guarda o tempo da última pergunta
const questionCooldown = 1000; // 1 segundo para evitar repetição imediata

function askQuestion(monster, index) {
  let question = monster.pergunta || "Qual é a capital da França?";
  let correctAnswer = monster.resposta.toLowerCase().trim() || "paris";

  // Se o monstro ainda não registrou erros, não há timer; caso contrário, usa a globalPenalty
  let initialCountdown =
    monster.errorCount && monster.errorCount > 0 ? globalPenalty : 0;

  let promptPromise;
  if (initialCountdown > 0) {
    promptPromise = showCustomPromptWithCountdown(question, initialCountdown);
  } else {
    promptPromise = showCustomPrompt(question);
  }
  console.log(correctAnswer);
  promptPromise.then((userAnswer) => {
    if (userAnswer && userAnswer.toLowerCase().trim() === correctAnswer) {
      showCustomAlert("Correto! O monstro foi derrotado!", "success");
      // Inicia a animação de fade-out (ou remova o monstro, conforme sua lógica)
      monster.dying = true;
      monster.opacity = 1;
      // Não reseta a globalPenalty para que ela continue acumulada entre os monstros
    } else {
      showCustomAlert("Errado! Tente novamente.", "error");
      // Se for o primeiro erro deste monstro, inicializa errorCount
      if (monster.errorCount === undefined) {
        monster.errorCount = 0;
      }
      // Incrementa o contador deste monstro
      monster.errorCount++;
      // Acumula a penalidade global com base no errorPenalty do monstro (ou 5 se não definido)
      globalPenalty += monster.errorPenalty || 5;
      // Tenta novamente a mesma pergunta (agora, com timer)
      askQuestion(monster, index);
      return; // Impede que a flag seja liberada antes da nova tentativa
    }
    keys = {}; // Limpa as teclas pressionadas
    questionActive = false;
  });
}

function updatePlayerDirection() {
  if (keys["ArrowUp"]) {
    player.image = playerImages.up;
  } else if (keys["ArrowDown"]) {
    player.image = playerImages.down;
  } else if (keys["ArrowLeft"]) {
    player.image = playerImages.left;
  } else if (keys["ArrowRight"]) {
    player.image = playerImages.right;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Desenha o mapa
  ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);

  // Desenha cada monstro ativo individualmente
  monsters.forEach((monster) => {
    if (monster.dying) {
      let prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = monster.opacity;
      ctx.drawImage(
        monsterImage,
        monster.x,
        monster.y,
        monster.width,
        monster.height,
        monster.x,
        monster.y,
        monster.width,
        monster.height
      );
      ctx.globalAlpha = prevAlpha;
    } else {
      ctx.drawImage(
        monsterImage,
        monster.x,
        monster.y,
        monster.width,
        monster.height,
        monster.x,
        monster.y,
        monster.width,
        monster.height
      );
    }
  });

  // Desenha os ajudantes
  helpers.forEach((helper) => {
    ctx.drawImage(
      helperImage,
      helper.x,
      helper.y,
      helper.width,
      helper.height,
      helper.x,
      helper.y,
      helper.width,
      helper.height
    );
  });

  // Desenha o personagem
  ctx.drawImage(player.image, player.x, player.y, player.width, player.height);

  applyVisionEffect();
}

function applyVisionEffect() {
  if (
    cachedGradient &&
    player.x === lastPlayerPos.x &&
    player.y === lastPlayerPos.y
  ) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = cachedGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  lastPlayerPos = { x: player.x, y: player.y };
  let visionRadius = 120;
  cachedGradient = ctx.createRadialGradient(
    player.x + player.width / 2,
    player.y + player.height / 2,
    30,
    player.x + player.width / 2,
    player.y + player.height / 2,
    visionRadius
  );
  cachedGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  cachedGradient.addColorStop(0.3, "rgba(0, 0, 0, 0.3)");
  cachedGradient.addColorStop(0.5, "rgba(0, 0, 0, 0.75)");
  cachedGradient.addColorStop(0.7, "rgba(0, 0, 0, 0.9)");
  cachedGradient.addColorStop(1, "rgba(0, 0, 0, 1)");
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = cachedGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
}

function gameLoop() {
  update();
  draw();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Pausa o jogo quando a aba perde o foco
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    gamePaused = true;
    cancelAnimationFrame(animationFrameId);
    console.log("Jogo pausado (aba fora de foco)");
  } else {
    console.log("Aba visível - pressione uma tecla para retomar");
    // O jogo retomará no próximo keydown (veja o listener de keydown acima)
  }
});

async function loadMapData() {
  const response = await fetch("Mapa1.json");
  const data = await response.json();

  const tileLayer = data.layers.find((layer) => layer.name === "Collisions");

  if (tileLayer && tileLayer.type === "tilelayer") {
    const tileWidth = data.tilewidth;
    const tileHeight = data.tileheight;
    tileLayer.data.forEach((tile, index) => {
      if (tile !== 0) {
        let x = (index % tileLayer.width) * tileWidth;
        let y = Math.floor(index / tileLayer.width) * tileHeight;
        walls.push({ x, y, width: tileWidth, height: tileHeight });
      }
    });
  }

  // Carrega a camada de monstros e agrupa os tiles
  const monsterLayer = data.layers.find((layer) => layer.name === "Monsters");
  if (monsterLayer && monsterLayer.type === "tilelayer") {
    const tileWidth = data.tilewidth;
    const tileHeight = data.tileheight;
    let monsterTiles = [];
    monsterLayer.data.forEach((tile, index) => {
      if (tile !== 0) {
        let x = (index % monsterLayer.width) * tileWidth;
        let y = Math.floor(index / monsterLayer.width) * tileHeight;
        monsterTiles.push({ x, y });
      }
    });
    monsterTiles.sort((a, b) => a.y - b.y || a.x - b.x);
    monsters = [];
    monsterTiles.forEach((tile) => {
      let found = false;
      for (let monster of monsters) {
        if (
          tile.x >= monster.x &&
          tile.x < monster.x + monster.width + 1 &&
          tile.y >= monster.y &&
          tile.y < monster.y + monster.height + 1
        ) {
          let newRight = Math.max(
            monster.x + monster.width,
            tile.x + tileWidth
          );
          let newBottom = Math.max(
            monster.y + monster.height,
            tile.y + tileHeight
          );
          monster.width = newRight - monster.x;
          monster.height = newBottom - monster.y;
          found = true;
          break;
        }
      }
      if (!found) {
        monsters.push({
          x: tile.x,
          y: tile.y,
          width: tileWidth,
          height: tileHeight,
        });
      }
    });
  }

  // Carrega a camada de ajudantes e agrupa os tiles
  const helperLayer = data.layers.find((layer) => layer.name === "Helpers");
  if (helperLayer && helperLayer.type === "tilelayer") {
    const tileWidth = data.tilewidth;
    const tileHeight = data.tileheight;
    let helperTiles = [];
    helperLayer.data.forEach((tile, index) => {
      if (tile !== 0) {
        let x = (index % helperLayer.width) * tileWidth;
        let y = Math.floor(index / helperLayer.width) * tileHeight;
        helperTiles.push({ x, y });
      }
    });
    // Ordena os tiles para facilitar o agrupamento
    helperTiles.sort((a, b) => a.y - b.y || a.x - b.x);
    helpers = [];
    helperTiles.forEach((tile) => {
      let found = false;
      for (let helper of helpers) {
        if (
          tile.x >= helper.x &&
          tile.x < helper.x + helper.width + 1 &&
          tile.y >= helper.y &&
          tile.y < helper.y + helper.height + 1
        ) {
          let newRight = Math.max(helper.x + helper.width, tile.x + tileWidth);
          let newBottom = Math.max(
            helper.y + helper.height,
            tile.y + tileHeight
          );
          helper.width = newRight - helper.x;
          helper.height = newBottom - helper.y;
          found = true;
          break;
        }
      }
      if (!found) {
        helpers.push({
          x: tile.x,
          y: tile.y,
          width: tileWidth,
          height: tileHeight,
        });
      }
    });
  }
}

Promise.all([
  new Promise((resolve, reject) => {
    monsterImage.onload = resolve;
    monsterImage.onerror = reject;
  }),
  new Promise((resolve, reject) => {
    helperImage.onload = resolve;
    helperImage.onerror = reject;
  }),
  loadMonsterQuestions(),
  loadHelperDialogs(),
])
  .then(() => {
    return loadMapData();
  })
  .then(() => {
    // Associa as perguntas aos monstros após carregar o mapa
    console.log(monsters);
    monsters.forEach((monster) => {
      let closestMonster = null;
      let minDistance = Infinity;

      monsterQuestions.forEach((monsterQuestion) => {
        // Calcula a distância absoluta entre o monstro do mapa e o do JSON
        let distance =
          Math.abs(monster.x - monsterQuestion.x) +
          Math.abs(monster.y - monsterQuestion.y);

        if (distance < minDistance) {
          minDistance = distance;
          closestMonster = monsterQuestion;
        }
      });

      if (closestMonster) {
        // Associa a pergunta, resposta e penalidade ao monstro correspondente
        monster.pergunta = closestMonster.pergunta;
        monster.resposta = closestMonster.resposta;
        monster.errorPenalty = closestMonster.errorPenalty;
      } else {
        console.warn(
          "Nenhuma pergunta encontrada para monstro em:",
          monster.x,
          monster.y
        );
      }
    });
    // *** NOVO: Associa os diálogos dos ajudantes dos dados do JSON aos objetos do array helpers ***
    helpers.forEach((helper, index) => {
      if (helperDialogs[index]) {
        helper.mensagem = helperDialogs[index].mensagem;
      }
    });
    console.log("Monstros, perguntas, ajudantes e mensagens carregados!");
    gameLoop();
  })
  .catch((error) => {
    console.error("Erro ao carregar recursos do jogo:", error);
  });

// Variável global para acumular a penalidade de erros (em segundos)
let globalPenalty = 0;

// Função que exibe um prompt customizado sem timer (quando globalPenalty é 0)
function showCustomPrompt(question) {
  return new Promise((resolve) => {
    let overlay = document.createElement("div");
    overlay.id = "customPromptOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "1000";

    let modal = document.createElement("div");
    modal.id = "customPromptModal";
    modal.style.backgroundColor = "#f4ecd8"; // Visual de pergaminho
    modal.style.border = "3px solid #5c3a21";
    modal.style.padding = "20px";
    modal.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    modal.style.fontFamily = "'MedievalSharp', 'IM Fell English', serif";
    modal.style.textAlign = "center";

    let qText = document.createElement("p");
    qText.textContent = question;
    modal.appendChild(qText);

    let input = document.createElement("input");
    input.type = "text";
    input.style.width = "80%";
    input.style.padding = "10px";
    input.style.margin = "10px 0";
    input.style.fontFamily = "inherit";
    modal.appendChild(input);

    // Área para o contador (fica vazia neste caso)
    let countdownText = document.createElement("p");
    countdownText.id = "countdownText";
    countdownText.style.marginTop = "10px";
    countdownText.style.fontSize = "18px";
    countdownText.style.color = "#5c3a21";
    modal.appendChild(countdownText);

    let okButton = document.createElement("button");
    okButton.textContent = "OK";
    okButton.style.padding = "10px 20px";
    okButton.style.fontFamily = "inherit";
    okButton.style.backgroundColor = "#8b5e3c";
    okButton.style.color = "#fff";
    okButton.style.border = "none";
    okButton.style.cursor = "pointer";
    okButton.addEventListener("click", () => {
      let answer = input.value;
      document.body.removeChild(overlay);
      resolve(answer);
    });
    modal.appendChild(okButton);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    input.focus();
    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") okButton.click();
    });
  });
}

// Função que exibe um prompt customizado com contador (quando o tempo > 0)
function showCustomPromptWithCountdown(question, seconds) {
  return new Promise((resolve) => {
    let overlay = document.createElement("div");
    overlay.id = "customPromptOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "1000";

    let modal = document.createElement("div");
    modal.id = "customPromptModal";
    modal.style.backgroundColor = "#f4ecd8";
    modal.style.border = "3px solid #5c3a21";
    modal.style.padding = "20px";
    modal.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    modal.style.fontFamily = "'MedievalSharp', 'IM Fell English', serif";
    modal.style.textAlign = "center";

    let qText = document.createElement("p");
    qText.textContent = question;
    modal.appendChild(qText);

    let input = document.createElement("input");
    input.type = "text";
    input.style.width = "80%";
    input.style.padding = "10px";
    input.style.margin = "10px 0";
    input.style.fontFamily = "inherit";
    modal.appendChild(input);

    // Área para o contador, que ficará abaixo da pergunta
    let countdownText = document.createElement("p");
    countdownText.id = "countdownText";
    countdownText.style.marginTop = "10px";
    countdownText.style.fontSize = "18px";
    countdownText.style.color = "#5c3a21";
    modal.appendChild(countdownText);

    let okButton = document.createElement("button");
    okButton.textContent = "OK";
    okButton.style.padding = "10px 20px";
    okButton.style.fontFamily = "inherit";
    okButton.style.backgroundColor = "#8b5e3c";
    okButton.style.color = "#fff";
    okButton.style.border = "none";
    okButton.style.cursor = "pointer";
    okButton.addEventListener("click", () => {
      let answer = input.value;
      document.body.removeChild(overlay);
      resolve(answer);
    });
    modal.appendChild(okButton);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Inicia o contador (desabilita input e botão enquanto o tempo não acaba)
    function startCountdown(sec) {
      if (sec > 0) {
        input.disabled = true;
        okButton.disabled = true;
        countdownText.textContent = "Aguarde: " + sec + " segundos";
        let interval = setInterval(() => {
          sec--;
          countdownText.textContent = "Aguarde: " + sec + " segundos";
          if (sec <= 0) {
            clearInterval(interval);
            input.disabled = false;
            okButton.disabled = false;
            countdownText.textContent = "";
            input.focus();
          }
        }, 1000);
      }
    }
    startCountdown(seconds);

    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter" && !input.disabled) okButton.click();
    });
    input.focus();
  });
}

// Função que exibe um alerta customizado (com tipo) e some após 3 segundos
function showCustomAlert(message, type) {
  let alertBox = document.createElement("div");
  alertBox.textContent = message;
  alertBox.style.position = "fixed";
  alertBox.style.top = "20px";
  alertBox.style.left = "50%";
  alertBox.style.transform = "translateX(-50%)";
  alertBox.style.padding = "10px 20px";
  alertBox.style.fontFamily = "'MedievalSharp', 'IM Fell English', serif";
  alertBox.style.zIndex = "1001";
  alertBox.style.border = "2px solid";
  alertBox.style.borderRadius = "5px";
  alertBox.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";

  if (type === "success") {
    alertBox.style.backgroundColor = "#d4edda";
    alertBox.style.color = "#155724";
    alertBox.style.borderColor = "#c3e6cb";
  } else if (type === "error") {
    alertBox.style.backgroundColor = "#f8d7da";
    alertBox.style.color = "#721c24";
    alertBox.style.borderColor = "#f5c6cb";
  } else {
    alertBox.style.backgroundColor = "#f4ecd8";
    alertBox.style.color = "#5c3a21";
    alertBox.style.borderColor = "#5c3a21";
  }

  document.body.appendChild(alertBox);
  setTimeout(() => {
    alertBox.style.transition = "opacity 0.5s";
    alertBox.style.opacity = "0";
    setTimeout(() => {
      if (alertBox.parentNode) alertBox.parentNode.removeChild(alertBox);
    }, 500);
  }, 3000);
}

// Função que exibe um modal com um contador regressivo
function showCountdown(seconds) {
  return new Promise((resolve) => {
    let overlay = document.createElement("div");
    overlay.id = "countdownOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "1000";

    let modal = document.createElement("div");
    modal.id = "countdownModal";
    modal.style.backgroundColor = "#f4ecd8";
    modal.style.border = "3px solid #5c3a21";
    modal.style.padding = "20px";
    modal.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    modal.style.fontFamily = "'MedievalSharp', 'IM Fell English', serif";
    modal.style.textAlign = "center";

    let timerText = document.createElement("p");
    timerText.textContent = seconds + " segundos";
    modal.appendChild(timerText);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let interval = setInterval(() => {
      seconds--;
      timerText.textContent = seconds + " segundos";
      if (seconds <= 0) {
        clearInterval(interval);
        document.body.removeChild(overlay);
        resolve();
      }
    }, 1000);
  });
}

function showHelperDialog(message) {
  return new Promise((resolve) => {
    // Cria o overlay
    let overlay = document.createElement("div");
    overlay.id = "helperDialogOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "1000";

    // Cria o modal
    let modal = document.createElement("div");
    modal.id = "helperDialogModal";
    modal.style.backgroundColor = "#f4ecd8"; // Visual tipo pergaminho
    modal.style.border = "3px solid #5c3a21";
    modal.style.padding = "20px";
    modal.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    modal.style.fontFamily = "'MedievalSharp', 'IM Fell English', serif";
    modal.style.textAlign = "center";

    // Texto da mensagem
    let mText = document.createElement("p");
    mText.innerHTML = message.replace(/\n/g, "<br>");
    modal.appendChild(mText);

    // Botão OK
    let okButton = document.createElement("button");
    okButton.textContent = "OK";
    okButton.style.padding = "10px 20px";
    okButton.style.fontFamily = "inherit";
    okButton.style.backgroundColor = "#8b5e3c";
    okButton.style.color = "#fff";
    okButton.style.border = "none";
    okButton.style.cursor = "pointer";
    okButton.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve();
    });
    modal.appendChild(okButton);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    okButton.focus();
  });
}

function askHelper(helper, index) {
  let message = helper.mensagem || "Aqui vai uma dica útil!";
  showHelperDialog(message).then(() => {
    // Após clicar OK, remove o ajudante
    helpers.splice(index, 1);
    keys = {}; // Limpa as teclas pressionadas
    questionActive = false;
  });
}

function completeGame() {
  let overlay = document.createElement("div");
  overlay.id = "gameCompletionOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "1000";

  let modal = document.createElement("div");
  modal.id = "gameCompletionModal";
  modal.style.backgroundColor = "#f4ecd8";
  modal.style.border = "4px solid #5c3a21";
  modal.style.padding = "30px";
  modal.style.boxShadow = "0 0 15px rgba(0,0,0,0.6)";
  modal.style.fontFamily = "'MedievalSharp', 'IM Fell English', serif";
  modal.style.textAlign = "center";
  modal.style.maxWidth = "600px";
  modal.style.borderRadius = "10px";

  let title = document.createElement("h1");
  title.textContent = "Parabéns por completar os desafios!";
  title.style.color = "#5c3a21";
  title.style.fontSize = "24px";
  title.style.marginBottom = "20px";

  let message = document.createElement("p");
  message.textContent =
    "A jornada foi árdua, repleta de desafios e aprendizado. Mas apenas aqueles que dominam a comunicação, o conhecimento e a sabedoria são capazes de trilhar esse caminho até o fim. Que essas lições o acompanhem além dos portões desta jornada.";
  message.style.fontSize = "18px";
  message.style.color = "#3a2a1e";
  message.style.marginBottom = "20px";

  let okButton = document.createElement("button");
  okButton.textContent = "Continuar";
  okButton.style.padding = "12px 25px";
  okButton.style.fontFamily = "inherit";
  okButton.style.backgroundColor = "#8b5e3c";
  okButton.style.color = "#fff";
  okButton.style.border = "none";
  okButton.style.cursor = "pointer";
  okButton.style.fontSize = "16px";
  okButton.style.borderRadius = "5px";
  okButton.style.transition = "background 0.3s";
  okButton.addEventListener("mouseover", () => {
    okButton.style.backgroundColor = "#6f4429";
  });
  okButton.addEventListener("mouseleave", () => {
    okButton.style.backgroundColor = "#8b5e3c";
  });

  okButton.addEventListener("click", () => {
    document.body.removeChild(overlay);
    alert("O jogo foi concluído! Obrigado por jogar.");
  });

  modal.appendChild(title);
  modal.appendChild(message);
  modal.appendChild(okButton);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  okButton.focus();
}
