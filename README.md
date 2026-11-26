# Timer Viking

Timer de treino HIIT/Tabata para **Android, iPhone, tablet e navegador**.

## Modos

| Aba | Função |
|-----|--------|
| **Tabata** | Preparar / exercício / descanso com foco na fase ativa |
| **Rondas** | Timer de rounds (boxe/MMA) |
| **Cronómetro** | Contagem crescente com voltas/intervalos |
| **Mais** | Configurações, atalhos e instalação |

## iPhone (Safari)

**https://plasma-system-rhmus59.shipstatic.com/**

1. Abra no **Safari**.  
2. Desative o **mute lateral** se quiser alertas sonoros.  
3. Toque **INICIAR** — o tempo aparece em **A reproduzir** na tela bloqueada.  
4. **Compartilhar** → **Adicionar à Tela de Início**.

## Android (APK) — versão **1.5.6**

**https://raw.githubusercontent.com/gabrielmarsaro/timer-plus/8470a43aeaaa2f849a08c7d0790dac7532a42779/releases/timer-plus-debug.apk**

1. Baixe no Chrome.  
2. Permita **fontes desconhecidas** se pedir.  
3. Instale / atualize.

Se der erro de pacote/assinatura: desinstale o app antigo e instale de novo.

Página de download: https://plasma-system-rhmus59.shipstatic.com/baixar.html

## Novidades 1.5.6

- **Pular** fase e **+15s** no meio do treino
- Mudar de aba / editar **não mata** a sessão ativa
- Onboarding na 1.ª abertura (mute / A2HS / APK)

## Identidade

**Timer Viking** — forja nórdica: carvão, ouro no esforço, gelo no descanso.

## Tabata (protocolo)

Padrão clássico: **preparar → (20s esforço / 10s pausa) × 8 rondas → cooldown**, com **descanso entre ciclos** se houver mais de 1 ciclo.  
No editor: botão **PRESET CLÁSSICO 20/10 × 8**.

## Música Tabata

Trilha **própria** (só na aba Tabata): **TABATA 160** / **HIIT 140** / **POWER 150**.  
A batida muda por fase, com cues **GO / REST** e **3-2-1**.

## Entrega em todas as plataformas

Toda mudança do app deve atualizar **código + web/iPhone + APK** no mesmo ciclo. Ver `AGENTS.md`.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build:docs
npm run android:apk
npm run smoke
node scripts/smoke-focus.mjs
node scripts/smoke-stopwatch.mjs
node scripts/smoke-music.mjs
node scripts/smoke-lockscreen.mjs
node scripts/smoke-wheel.mjs
```
