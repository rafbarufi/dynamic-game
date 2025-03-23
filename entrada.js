const questionData = {
  question:
    "Encontre os QR Codes espalhados para entrar na caverna da dinâmica.<br/><br/>Qual a chave de entrada do desafio?",
  correctAnswer: "18chave6i",
};

// Exibir pergunta na tela
document.getElementById("question").innerHTML = questionData.question;

// Função de validação da resposta
function validateAnswer() {
  let userAnswer = document.getElementById("answer").value.trim().toLowerCase();
  let feedback = document.getElementById("feedback");

  if (userAnswer === questionData.correctAnswer) {
    feedback.textContent = "Resposta correta! Portal liberado...";
    feedback.style.color = "#6aff6a";

    setTimeout(() => {
      window.location.href = "game.html"; // Redireciona para o jogo
    }, 1500);
  } else {
    feedback.textContent = "Resposta incorreta! Tente novamente.";
    feedback.style.color = "#ff4d4d";
  }
}
