# Timer Plus

Timer de treino HIIT/Tabata para **Android, iPhone, tablet e navegador**.

## Por que no iPhone é web?

A Apple **não deixa instalar APK** (isso é Android). App nativo na App Store precisa conta de desenvolvedor Apple + Mac/Xcode. Por isso no iPhone usamos o **Safari → Adicionar à Tela de Início** (funciona como app, sem App Store).

## iPhone (Safari) — som

### https://shifting-flow-pg8b23q.shipstatic.com

1. Abra no **Safari**.  
2. **Desative o mute lateral** (switch acima dos botões de volume) e aumente o volume.  
3. **Compartilhar** → **Adicionar à Tela de Início**.  
4. Abra o ícone e toque em **INICIAR** (o toque libera o áudio do Safari).

> Com o mute ligado, o iPhone silencia sons da web — inclusive voz e beeps.

## Android (APK)

**https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk**

## Desenvolvimento

```bash
npm install
npm run dev
npm run build:docs
npm run android:apk
npm run smoke
node scripts/smoke-focus.mjs
```
