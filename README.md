# Squelch 2

## Executar em poucos passos

1. Instale Java 17 ou superior. Para recompilar, use um **JDK**, não apenas o runtime.
2. Execute o JAR incluído:

```sh
java -jar build/squelch-java.jar
```

4. Abra **http://127.0.0.1:8080** no navegador e pressione Play ou Espaço.
5. Para encerrar, pressione `Ctrl+C` no terminal.

O JAR já contém a interface. Não é necessário instalar Maven, Gradle, Node.js, banco de dados, plugins de navegador ou bibliotecas externas. Após instalar Java, o aplicativo funciona localmente sem internet. Não abra `index.html` diretamente: a interface usa a API Java.

### Compilar e testar no Windows

Com JDK 17+ no `PATH` ou configurado em `JAVA_HOME`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1 -Test
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
```

O parâmetro de política vale apenas para esse processo. Também é possível executar `./build.ps1 -Test` e `./run.ps1` diretamente quando a configuração local permite scripts.

### Compilar e testar no Linux/macOS

```sh
sh build.sh --test
sh run.sh
```

Os scripts recompilam o código Java e empacotam os arquivos web em `build/squelch-java.jar`. Depois de alterar código Java ou arquivos web, execute o build novamente. `run` compila automaticamente apenas quando o JAR ainda não existe.

### Outra porta ou acesso pela rede

```sh
java -jar build/squelch-java.jar 9090
java -jar build/squelch-java.jar 9090 0.0.0.0
```

O primeiro argumento é a porta; o segundo é o endereço de escuta. O padrão é `127.0.0.1:8080`, acessível apenas no próprio computador. Para disponibilização pública, use uma hospedagem capaz de executar Java e um proxy HTTPS. GitHub Pages hospeda somente arquivos estáticos e não executa este servidor Java.

## Usar o sequenciador

- **Play / Espaço:** iniciar ou parar. O navegador libera áudio após uma interação.
- **Botão de sorriso / G:** gerar outra linha com as configurações atuais.
- **Tempo:** 80–180 BPM pela interface; o delay acompanha o tempo em 3/16.
- **Sound:** cutoff, ressonância, modulação de envelope, decay, intensidade do acento, drive, delay, volume e onda SAW/SQR.
- **Generate:** escala, tonalidade, 8/16/24/32 passos, densidade, chance de acentos, chance de slides e 1/2/3 oitavas.
- As seis escalas originais estão disponíveis: Minor, Phrygian, Minor Pentatonic, Dorian, Harmonic Minor e Major. Há 12 tonalidades de A1 a G#2.
- A grade mostra notas, pausas, acentos em âmbar, slides em magenta e o passo atual; o osciloscópio acompanha o sinal.
- **Ableton / FL Studio:** baixar a sequência exibida como `.mid`, com o BPM atual.

Alterações de geração solicitam outra sequência ao Java. A anterior continua tocando enquanto a resposta chega; a nova é usada nos próximos passos ainda não agendados. A fila de áudio antecipa aproximadamente 100 ms. Mudanças rápidas descartam respostas antigas.

Os atalhos globais não interceptam campos e botões com foco. Em telas pequenas, a grade possui rolagem horizontal própria. Como no original, não há edição manual das notas, contas, gravação de áudio ou persistência de projetos. Recarregar a página cria outra sequência.

### Importar MIDI

No Ableton, arraste o arquivo para uma pista MIDI. No FL Studio, use a importação MIDI ou arraste o arquivo para o ambiente apropriado do programa. Escolha um instrumento mono com portamento/glide para interpretar a sobreposição de notas como slides.

O arquivo é Standard MIDI File tipo 1, com duas pistas, resolução de 96 PPQ e compasso 4/4. Cada passo equivale a uma semicolcheia (24 ticks); 16 passos formam um compasso. Acentos usam velocity 118; notas normais, 92. Slides prolongam a nota por 8 ticks além do próximo passo; a última nota é limitada ao fim do loop, como no original. Os dois botões mudam o nome da pista e do arquivo, preservando o mesmo formato MIDI.

MIDI contém notas e tempo, não o som sintetizado nem os ajustes de cutoff/drive/delay. O resultado sonoro na DAW depende do instrumento escolhido.

## Estrutura

```text
src/main/java/squelch/
  App.java              Servidor HTTP, recursos web e validação da API
  Music.java            Escalas, nomes e intervalos
  Generator.java        Geração musical em Java
  Pattern.java          Sequência e passos imutáveis
  MidiExporter.java     Exportação via javax.sound.midi
  Json.java             Serialização de strings JSON
src/main/resources/web/
  main.js, api.js        Controles e comunicação com Java
  audio/                Síntese e efeitos Web Audio
  sequencer/            Agendamento com relógio de áudio
  ui/                   Grade, controles e osciloscópio
src/test/               Testes Java e 216 casos de referência
tests/                  Teste opcional de navegador com Playwright
build/squelch-java.jar   Aplicativo executável
```

Detalhes: [arquitetura e API](docs/ARCHITECTURE.md), [relatório de validação](docs/VALIDATION.md), [origem e atribuições](THIRD_PARTY_NOTICES.md).

## Testes opcionais de navegador

Os testes Java não exigem dependências. Para repetir a verificação adicional de navegador, é necessário Node.js e Chrome instalado:

```sh
npm --prefix tests install
java -jar build/squelch-java.jar 8765
```

Em outro terminal, na pasta do projeto:

```sh
npm --prefix tests test
```

Os resultados visuais e downloads de teste são gravados em `build/browser-qa`. O teste usa o Chrome em modo sem janela e verifica o sinal de áudio internamente. A variável `SQUELCH_URL` pode apontar para outra porta. Os scripts de shell foram incluídos, mas a execução desta entrega foi validada no Windows.

## Solução de problemas

- **`java`/`javac` não encontrado:** instale o JDK e adicione sua pasta `bin` ao `PATH`, ou configure `JAVA_HOME` para os scripts.
- **Porta ocupada:** execute em outra porta, por exemplo `9090`.
- **Sem som:** pressione Play, confira o volume da interface e o volume/mute da aba e do sistema. Use um navegador atualizado com Web Audio.
- **Falha ao gerar/exportar:** mantenha o terminal do servidor aberto. A última sequência carregada permanece disponível para reprodução.
- **Navegador suspendeu a aba:** retorne à aba e pare/inicie a reprodução. Abas em segundo plano podem ser limitadas pelo navegador.
