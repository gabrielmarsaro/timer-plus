# Timer Plus

Timer de treino HIIT/Tabata para **celular, tablet e Android** (instalação por APK / fontes desconhecidas).

## Baixar o APK (tablet / celular)

👉 **[Download timer-plus-debug.apk](https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk)**

Ou no GitHub: abra a pasta [`releases/`](https://github.com/gabrielmarsaro/timer-plus/tree/main/releases) e clique no arquivo `timer-plus-debug.apk` → **Download**.

### Modos

| Aba | Status |
|-----|--------|
| **Tabata** | Pronto |
| **Rondas** | Pronto (boxe/MMA: preparar → ronda → descanso) |
| Cronómetro | Em breve |
| Mais | Em breve |

### Instalar / atualizar no tablet

1. No tablet, abra o link acima (Chrome) e baixe o APK.
2. Abra o arquivo baixado.
3. Se bloquear, ative **Instalar apps desconhecidos** para o Chrome/Arquivos.
4. Toque em **Instalar** / **Atualizar** → **Abrir**.
5. Abra a aba **RONDAS** na barra inferior.

## Rodar no navegador

```bash
npm install
npm run dev
```

## Gerar o APK de novo

Requisitos: **JDK 17+** e **Android SDK**.

```bash
npm install
npm run android:apk
```

Arquivo gerado: `android/app/build/outputs/apk/debug/app-debug.apk`

## Layout

| Dispositivo | Comportamento |
|-------------|---------------|
| Celular | UI compacta, números grandes, alto contraste |
| Tablet | Tipografia maior, blocos com respiro |
| Tablet landscape | Fase atual e próxima **lado a lado** |

## Scripts

| Comando | Função |
|---------|--------|
| `npm run dev` | Servidor web local |
| `npm run build` | Build web (`dist/`) |
| `npm run cap:sync` | Build + sincroniza Capacitor Android |
| `npm run android:apk` | Gera o APK debug |
| `npm run smoke` | Teste rápido start/pause (Playwright) |

## Estrutura

- `src/` — app React (Tabata, settings, navegação)
- `android/` — projeto nativo Capacitor
- `releases/` — APK pronto para instalar
- `capacitor.config.ts` — id `com.timerplus.app`
