# Squelch 2

Sequenciador web de baixo acid com geração de padrões, síntese em tempo real e exportação MIDI. O servidor Java implementa a geração musical e a exportação; a interface utiliza Web Audio para síntese, efeitos e reprodução no navegador.

## Requisitos

- JDK 17 ou superior, disponível no `PATH` ou configurado em `JAVA_HOME`.
- Navegador atualizado com suporte a Web Audio.
- Node.js e Google Chrome para os testes de navegador, opcionais.

## Instalação e execução

```sh
git clone https://github.com/zqovark/squeltch-2.git
cd squeltch-2
```

### Windows

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
```

### Linux e macOS

```sh
sh build.sh
sh run.sh
```

Acesse [http://127.0.0.1:8080](http://127.0.0.1:8080). Para encerrar o servidor, pressione `Ctrl+C` no terminal.

A compilação gera `build/squelch-java.jar`, incluindo os recursos da interface. Esse arquivo não é versionado. Após alterações no código ou nos recursos web, execute o build novamente.

O JAR também pode ser executado diretamente:

```sh
java -jar build/squelch-java.jar
```

### Endereço e porta

```sh
java -jar build/squelch-java.jar 9090
java -jar build/squelch-java.jar 9090 0.0.0.0
```

Os argumentos definem, respectivamente, a porta e o endereço de escuta. O padrão é `127.0.0.1:8080`. O endereço `0.0.0.0` permite conexões pelas interfaces de rede disponíveis. Uma implantação pública requer um ambiente capaz de executar Java e um proxy HTTPS.

## Controles

| Controle | Função |
| --- | --- |
| Play / Espaço | Iniciar ou parar a reprodução |
| Generate / G | Gerar um padrão com as configurações atuais |
| Tempo | Ajustar o andamento entre 80 e 180 BPM |
| Sound | Ajustar cutoff, ressonância, envelope, decay, acento, drive, delay, volume e forma de onda SAW/SQR |
| Generate | Selecionar escala, tonalidade, comprimento, densidade, acentos, slides e extensão em oitavas |
| Ableton / FL Studio | Exportar o padrão exibido em formato MIDI |

O gerador oferece seis escalas — Minor, Phrygian, Minor Pentatonic, Dorian, Harmonic Minor e Major —, 12 tonalidades entre A1 e G#2, sequências de 8, 16, 24 ou 32 passos e extensão de uma a três oitavas.

A grade identifica notas, pausas, acentos, slides e o passo em reprodução. O osciloscópio exibe o sinal de saída. Alterações nos parâmetros de geração atualizam a sequência durante a reprodução, preservando o padrão anterior até a chegada da resposta do servidor.

Os atalhos globais ficam inativos quando um campo ou botão está com foco. O estado da sequência é mantido na aba; recarregar a página gera um novo padrão. Novas gerações e exportações dependem do servidor ativo.

## Exportação MIDI

Os dois destinos utilizam Standard MIDI File tipo 1, com duas pistas, resolução de 96 PPQ, compasso 4/4 e tempo incorporado. Cada passo corresponde a uma semicolcheia; 16 passos formam um compasso.

- Notas acentuadas usam velocity 118; as demais, 92.
- Slides são representados por sobreposição de notas de 8 ticks.
- A última nota termina no limite do loop.
- Os destinos diferem no nome do arquivo e da pista.

Importe o arquivo em uma pista MIDI da DAW. Para reproduzir os slides, utilize um instrumento monofônico com portamento. O MIDI contém notas, velocidades e tempo; os parâmetros de síntese e efeitos devem ser configurados no instrumento de destino.

## Estrutura

```text
src/main/java/squelch/       Servidor HTTP, gerador, escalas e exportação MIDI
src/main/resources/web/     Interface, síntese Web Audio e agendamento
src/test/                  Testes Java e casos de referência do gerador
tests/                     Testes de navegador com Playwright
build/                     Artefatos gerados pela compilação
```

## Testes

### Java

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1 -Test
```

```sh
sh build.sh --test
```

A suíte verifica 216 casos de referência do gerador, a estrutura e os eventos MIDI, a validação da API e requisições concorrentes. Utiliza apenas o JDK.

### Navegador

Após compilar o projeto, instale as dependências de teste e inicie o servidor:

```sh
npm --prefix tests install
java -jar build/squelch-java.jar 8765
```

Em outro terminal, na raiz do repositório:

```sh
npm --prefix tests test
```

O Playwright executa o Chrome em modo headless e verifica controles, reprodução, sinal de áudio, exportação e comportamento em telas pequenas. Capturas e downloads são gravados em `build/browser-qa`. A variável `SQUELCH_URL` permite definir outro endereço para o servidor.

A execução foi validada no Windows. Os scripts para Linux e macOS estão disponíveis, mas ainda não foram validados nesses sistemas.
