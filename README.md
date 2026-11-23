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

**https://woven-photon-45c57ty.shipstatic.com**

1. Abra no **Safari**.  
2. Desative o **mute lateral** e aumente o volume.  
3. **Compartilhar** → **Adicionar à Tela de Início**.

## Android (APK) — versão **1.3.0**

**https://raw.githubusercontent.com/gabrielmarsaro/timer-plus/d80d3807338fafb23cfa47b595c0f06ffaeaab2b/releases/timer-plus-debug.apk**

1. Baixe no Chrome.  
2. Permita **fontes desconhecidas** se pedir.  
3. Instale / atualize.

Se der erro de pacote/assinatura: desinstale o app antigo e instale de novo.

Página de download: https://woven-photon-45c57ty.shipstatic.com/baixar.html

## Música Tabata

- Só na aba **Tabata** (não em Rondas/Cronómetro).
- **YouTube** (padrão): botão **MÚSICA NO YOUTUBE** abre a faixa pública no YouTube — sem vídeo embutido no timer.
- **Batidas offline**: ritmo próprio do app (Pulse / Drive / Storm).
- “Respeitar música” silencia o tique-taque se Spotify/YouTube já estiver tocando.

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
