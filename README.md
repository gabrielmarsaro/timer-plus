# Timer Plus

Timer de treino HIIT/Tabata para **Android, iPhone, tablet e navegador**.

## iPhone (Safari)

### 1) Ativar GitHub Pages (só uma vez)

1. Abra: https://github.com/gabrielmarsaro/timer-plus/settings/pages  
2. Em **Build and deployment** → **Source**, escolha **GitHub Actions**.  
3. Salve. O deploy roda sozinho no próximo push (ou em Actions → **Deploy GitHub Pages** → **Run workflow**).

### 2) Abrir no iPhone

No Safari:

**https://gabrielmarsaro.github.io/timer-plus/**

1. Toque em **Compartilhar** (quadrado com seta).  
2. Toque em **Adicionar à Tela de Início**.  
3. Confirme **Adicionar**.  
4. Abra o ícone **Timer Plus** como um app.

> No iPhone não dá para instalar APK. A versão web na Tela de Início é o caminho certo (sem App Store).

## Android (APK)

Download direto:

**https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk**

1. Abra no Chrome e baixe.  
2. Permita **fontes desconhecidas** se pedir.  
3. Instale / atualize.

Também há a página: https://gabrielmarsaro.github.io/timer-plus/baixar.html

## Modos

| Aba | Status |
|-----|--------|
| **Tabata** | Pronto |
| **Rondas** | Pronto |
| Cronómetro | Em breve |
| Mais | Em breve |

## Desenvolvimento

```bash
npm install
npm run dev
```

### Gerar APK Android

```bash
npm run android:apk
```

Arquivo: `android/app/build/outputs/apk/debug/app-debug.apk`

## Scripts

| Comando | Função |
|---------|--------|
| `npm run dev` | Servidor web local |
| `npm run build` | Build web (`dist/`) |
| `npm run android:apk` | Gera o APK debug |
| `npm run smoke` | Teste rápido (Playwright) |
