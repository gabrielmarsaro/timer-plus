# Timer Plus

Timer de treino HIIT/Tabata para **Android, iPhone, tablet e navegador**.

## Modos

| Aba | Função |
|-----|--------|
| **Tabata** | Preparar / exercício / descanso com foco na fase ativa |
| **Rondas** | Timer de rounds (boxe/MMA) |
| **Cronómetro** | Contagem crescente com voltas/intervalos |
| **Mais** | Configurações, atalhos e instalação |

## iPhone (Safari)

**https://dreamy-lens-j3fuq97.shipstatic.com/**

1. Abra no **Safari**.  
2. Desative o **mute lateral** e aumente o volume.  
3. Toque **INICIAR** — o tempo aparece em **A reproduzir** na tela bloqueada.  
4. **Compartilhar** → **Adicionar à Tela de Início**.

## Android (APK) — versão **1.4.2**

**https://raw.githubusercontent.com/gabrielmarsaro/timer-plus/e4b0359aeb63704124bc7bfad3120f25f333bba0/releases/timer-plus-debug.apk**

1. Baixe no Chrome.  
2. Permita **fontes desconhecidas** se pedir.  
3. Instale / atualize.

Se der erro de pacote/assinatura: desinstale o app antigo e instale de novo.

Página de download: https://dreamy-lens-j3fuq97.shipstatic.com/baixar.html

## Tabata (protocolo)

Padrão clássico: **preparar → (20s esforço / 10s pausa) × 8 rondas → cooldown**, com **descanso entre ciclos** se houver mais de 1 ciclo.  
No editor: botão **PRESET CLÁSSICO 20/10 × 8**.

## Música Tabata

Trilha **própria** (só na aba Tabata): **TABATA 160** / **HIIT 140** / **POWER 150**.  
A batida muda por fase (preparar, esforço, pausa, entre ciclos, cooldown), com cues **GO / REST** e **3-2-1**.

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
```
