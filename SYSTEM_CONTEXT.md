# GRATÃO FLOW - SYSTEM_CONTEXT

Este arquivo é a fonte de contexto operacional do Gratão Flow para manutenção, implementação e validação. Antes de alterar o sistema, leia este documento e preserve as regras de negócio descritas aqui.

---

## Identidade Do Sistema

Nome: Gratão Flow
Empresa: Gratão Uniformes
Tipo: sistema de gestão operacional, produtiva e financeira para malharia/uniformes.

Objetivo:

Controlar o fluxo completo da operação:

Cliente -> Pedido de Cliente -> Ordem de Serviço -> Produção -> Terceirização -> Entrega -> Financeiro -> Relatórios

O sistema deve ser operacional, direto e auditável. Ele não é uma landing page, CRM genérico ou ERP amplo; é uma ferramenta diária para acompanhar OS, produção, estoque de peças, terceirização, entregas, recebimentos, equipe e fechamentos.

---

## Stack Tecnológica

Backend:

- Python 3.11
- FastAPI
- SQLAlchemy 2.0
- PostgreSQL
- Alembic
- Pydantic
- JWT
- Passlib/bcrypt
- ReportLab para PDFs

Frontend:

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Hook Form
- Zod
- Lucide React

Infra:

- Docker
- Docker Compose
- Backend executa migrations Alembic e seed base no startup.

Comandos importantes:

```bash
npm run typecheck
docker compose --env-file .env -f docker/docker-compose.yml up --build -d
```

---

## Princípios Do Sistema

1. Simplicidade operacional.
2. Consistência de dados acima de conveniência visual.
3. Regras de negócio explícitas no backend.
4. Nada implícito ou mágico em cálculos financeiros.
5. Histórico produtivo e operacional sempre auditável.
6. Migrations novas para alterações de banco; nunca editar migrations antigas já existentes.
7. Dinheiro sempre com `Decimal`/`Numeric`, nunca `float`.
8. Frontend deve refletir as regras do backend, não substituí-las.
9. Relatório do cliente nunca expõe dados internos.
10. Relatório interno deve mostrar rastreabilidade operacional e financeira.

---

## Conceitos Principais

### Cliente

Representa o cliente comercial da Gratão Uniformes.

Campos principais:

- nome
- telefone
- tipo
- observações
- ativo/inativo

Clientes com OS ou Pedidos de Cliente não devem ser apagados fisicamente; devem ser inativados quando necessário.

### Ordem De Serviço

A OS é a unidade operacional de produção.

Regra atual:

- Uma OS pode conter vários produtos/modelos/tamanhos/cores por meio de `OrderItem`.
- Cada item da OS tem seu próprio produto, tamanho, cor, quantidade, prioridade, modo de confecção e serviços.
- Os campos legados da OS (`product_id`, `size_id`, `color`, `quantity_requested`, etc.) funcionam como snapshot/resumo para compatibilidade e listagem.
- A produção real deve considerar os itens ativos da OS.

Exemplo válido:

- OS 42
  - Item 1: Blusa, tamanho 12, Azul Bebê, 120 peças, Corte + DTF + Confecção interna
  - Item 2: Casaco, tamanho 8, Azul Royal, 120 peças, Corte + DTF + Terceirização
  - Item 3: Calça, tamanho 8, Azul Royal, 150 peças, Corte + Confecção interna

Não voltar a bloquear mistura de produtos/modelos dentro da mesma OS. Essa regra antiga foi removida.

### Pedido De Cliente

O Pedido de Cliente é a unidade comercial/financeira agrupada.

Ele agrupa várias OS do mesmo cliente sem alterar a produção individual de cada OS.

Uso esperado:

- consolidar valor total cobrado;
- consolidar valor pago;
- consolidar saldo;
- consolidar status financeiro;
- consolidar status produtivo;
- visualizar OS vinculadas;
- emitir relatório/PDF agrupado para cliente;
- emitir relatório/PDF interno agrupado.

Uma OS pertence a no máximo um Pedido de Cliente por vez.

### Item Da OS

Um `OrderItem` é a menor unidade operacional dentro da OS.

Campos importantes:

- produto
- tamanho
- cor obrigatória
- quantidade solicitada
- quantidade cortada/destinada
- quantidade estampada
- quantidade costurada
- quantidade entregue
- prioridade operacional
- modo de confecção (`internal` ou `outsourced`, quando aplicável)
- serviços do item
- cancelamento do item, com motivo
- histórico de entrega
- terceirizações vinculadas

Itens sem movimento podem ser removidos pela edição da OS. Itens com movimento devem seguir regras seguras de cancelamento.

---

## Cadastros Base

Seed base:

- Produtos: Blusa, Casaco, Calça, Short, Short saia.
- Tamanhos: 4, 6, 8, 10, 12, 14, 16, PP, P, M, G, GG.
- Serviços:
  - Corte: R$ 1,00 por peça
  - Confecção: R$ 5,00 por peça
  - DTF frente: R$ 1,50 por peça
  - DTF frente e costas: R$ 3,00 por peça

Serviços têm preço por unidade. O preço usado na OS é congelado no momento da criação/edição do item e salvo em `OrderItemService`/`OrderService`.

Mudanças futuras no cadastro de serviço não devem alterar OS antigas automaticamente.

---

## Regras Financeiras Da OS

O total da OS é calculado por:

```text
total_amount = soma dos serviços dos itens ativos + soma da terceirização vendida ativa
```

Para cada serviço:

```text
total_price = quantidade do item x preço unitário congelado
```

Para terceirização:

```text
customer_total = quantidade enviada x preço unitário cobrado do cliente
outsourcer_total = quantidade enviada x preço unitário do terceirizado
profit_total = customer_total - outsourcer_total
```

Campos consolidados da OS:

- `total_amount`: total do pedido/cobrado do cliente, incluindo terceirização vendida.
- `amount_paid`: soma dos pagamentos registrados na OS.
- `amount_due`: saldo a receber.
- `outsourcing_revenue_total`: valor vendido ao cliente na terceirização.
- `outsourcing_cost_total`: custo total do terceirizado.
- `outsourcing_paid_total`: repasse já pago ao terceirizado.
- `outsourcing_pending_total`: repasse pendente ao terceirizado.
- `estimated_result`: `total_amount - outsourcing_cost_total`.

Status financeiro:

- `pending`: nada pago.
- `partial`: pago maior que zero e menor que o total.
- `paid`: pago maior ou igual ao total.

Pagamentos ficam na OS. Pedido de Cliente apenas consolida os pagamentos das OS vinculadas.

Não criar rateio automático de pagamento entre itens ou Pedido de Cliente sem regra explícita.

---

## Terceirização

Terceirização é registrada em `OrderOutsourcing` e pode estar vinculada a um item da OS.

Regras atuais:

- Terceirização sempre retorna para a Gratão antes da entrega ao cliente.
- `direct_to_customer` não é permitido no fluxo atual.
- O item terceirizado deve usar `sewing_mode=outsourced`.
- Item terceirizado não deve incluir serviço de Confecção interna.
- O valor cobrado do cliente pela terceirização entra no total da OS.
- O custo do terceirizado fica separado para cálculo interno de resultado.
- Repasse ao terceirizado é controlado por `payout_status`.

Fluxo:

1. Enviar item para terceirização.
2. Registrar quantidade enviada, preço cobrado do cliente e custo do terceirizado.
3. Sistema soma `customer_total` no total cobrado da OS.
4. Registrar retorno parcial ou total.
5. Registrar repasse pago ao terceirizado.

Eventos gerados:

- `outsourcing_sent`
- `outsourcing_returned`
- `outsourcing_payout_paid`

Relatório/PDF do cliente pode mostrar a terceirização como serviço vendido, mas nunca deve mostrar custo do terceiro, repasse, margem, lucro ou eventos internos.

Relatório/PDF interno deve mostrar terceirizações, custos, repasses e resultado.

---

## Produção

Status produtivos:

- `created`
- `in_progress`
- `partial_ready`
- `mixed`
- `in_cut`
- `cut_done`
- `waiting_print`
- `in_print`
- `print_done`
- `waiting_sewing`
- `in_sewing`
- `sewing_done`
- `outsourced`
- `returned`
- `ready`
- `delivered`
- `cancelled`

O status da OS é derivado dos itens ativos:

- se todos entregues: `delivered`;
- se a OS foi cancelada: `cancelled`;
- se há um único item ativo: status derivado desse item;
- se todos os itens ativos estão completos: `ready`;
- se parte dos itens está pronta: `partial_ready`;
- se há vários estágios produtivos ao mesmo tempo: `mixed` ou `in_progress`, conforme agregação;
- se não há movimento: `created`.

Não manipular status produtivo individual de forma solta. Toda alteração de quantidade deve sincronizar o snapshot e registrar evento quando aplicável.

### Corte

Regras:

- O corte físico gera entrada no estoque livre de peças cortadas.
- `quantity_cut` do item representa peças destinadas/liberadas para aquele item da OS.
- Corte físico não destina automaticamente peças para a OS além do fluxo implementado.
- Pode haver corte maior que a necessidade, gerando estoque livre.
- Destinação de estoque para OS movimenta estoque e incrementa `quantity_cut`.
- Devolução de peças destinadas devolve ao estoque e reduz `quantity_cut`.

Eventos:

- `cut_registered`
- `cut_pieces_allocated`
- `cut_pieces_returned`

### DTF

Regras por produto:

- Blusa: frente ou frente e costas.
- Casaco: frente.
- Calça, Short e Short saia: exigem exceção (`allow_printing_exception`) para permitir DTF.

Validações:

- Não imprimir sem quantidade cortada/destinada suficiente.
- Não imprimir mais que o saldo disponível.
- Respeitar item cancelado e OS pausada/cancelada/entregue.

Evento:

- `print_registered`

### Confecção Interna

Regras:

- Se houver DTF, costurar somente quantidade já estampada.
- Se não houver DTF, costurar somente quantidade cortada/destinada.
- Item com `sewing_mode=outsourced` não usa Confecção interna.

Evento:

- `sewing_registered`

### Pausa Da Produção

Uma OS pode ser pausada e retomada.

Eventos:

- `production_paused`
- `production_resumed`

Produção pausada bloqueia operações produtivas e entrega até retomada.

### Perdas, Retrabalho E Ajustes

Eventos operacionais disponíveis:

- `loss_registered`
- `rework_registered`
- `adjustment_registered`

Ajustes exigem motivo e observação. Não devem ser usados para apagar histórico; devem corrigir quantidade com rastreabilidade.

---

## Entregas

Entrega é controlada por item.

Status de entrega:

- `pending`
- `ready`
- `partially_delivered`
- `delivered`

Um item fica disponível para entrega conforme sua rota:

- item com confecção interna: quantidade costurada;
- item com DTF e sem confecção: quantidade estampada;
- item só com corte: quantidade cortada;
- item terceirizado: quantidade retornada da terceirização;
- item sem serviço produtivo: quantidade solicitada.

Registro de entrega exige:

- quantidade disponível;
- responsável/usuário;
- quem retirou;
- documento ou contato de retirada.

Eventos:

- `delivery_registered`
- `status_changed` para `delivered` quando todos os itens ativos são entregues.

Entregas parciais são permitidas e ficam em histórico.

---

## Estoque

Categorias:

- `material`
- `piece`

Movimentos:

- `entry`
- `exit`
- `adjustment`
- `excess_cut`
- `cut_entry`
- `allocated_to_order`
- `returned_from_order`
- `loss`

Regras:

- Estoque não pode ficar negativo.
- Peça cortada (`piece`) exige produto, tamanho e cor.
- Estoque de peça cortada é compatibilizado por produto + tamanho + cor.
- Destinar peça para OS reduz estoque livre.
- Devolver peça da OS aumenta estoque livre.

---

## Pedido De Cliente

Modelo: `ClientOrderGroup`.

Campos principais:

- id
- cliente
- referência
- observações
- datas de criação e atualização
- OS vinculadas
- totais consolidados calculados
- status produtivo consolidado
- status financeiro consolidado

Regras de vínculo:

- Pedido de Cliente exige cliente ativo.
- Deve iniciar com uma ou mais OS.
- Todas as OS vinculadas precisam ser do mesmo cliente.
- OS de outro cliente não pode ser vinculada.
- OS já vinculada a outro Pedido de Cliente não pode ser vinculada de novo.
- Duplicar a mesma OS no payload é bloqueado.
- OS canceladas não aparecem como disponíveis para vincular.
- Ao apagar Pedido de Cliente, as OS não são apagadas; elas são desvinculadas.

Consolidação:

- `total_amount`: soma dos totais das OS.
- `amount_paid`: soma dos pagamentos das OS.
- `amount_due`: soma dos saldos das OS.
- `quantity_requested`: soma das quantidades das OS.
- `outsourcing_revenue_total`: soma da terceirização vendida das OS.
- `outsourcing_cost_total`: soma dos custos terceirizados.
- `outsourcing_paid_total`: soma dos repasses pagos.
- `outsourcing_pending_total`: soma dos repasses pendentes.
- `estimated_result`: soma dos resultados estimados das OS.

Status financeiro consolidado:

- `pending`: total pago igual a zero.
- `partial`: pago maior que zero e menor que total.
- `paid`: pago maior ou igual ao total.

Status produtivo consolidado:

- derivado dos status das OS vinculadas;
- todos entregues vira `delivered`;
- todos prontos/entregues vira equivalente consolidado pronto;
- mistura de status vira `mixed` quando aplicável;
- OS individual continua independente.

---

## Relatórios E PDFs

Há relatórios JSON e PDF para OS individual e Pedido de Cliente agrupado.

OS individual:

- `GET /orders/{order_id}/report/client`
- `GET /orders/{order_id}/report/internal`
- `GET /orders/{order_id}/report/client/pdf`
- `GET /orders/{order_id}/report/internal/pdf`

Pedido de Cliente:

- `GET /order-groups/{group_id}/report/client`
- `GET /order-groups/{group_id}/report/internal`
- `GET /order-groups/{group_id}/report/client/pdf`
- `GET /order-groups/{group_id}/report/internal/pdf`

PDF do cliente:

- identificação Gratão Uniformes;
- OS ou Pedido de Cliente;
- cliente e telefone;
- itens/produtos/tamanhos/cores;
- serviços vendidos;
- terceirização vendida como item de cobrança quando existir;
- total do pedido;
- valor pago;
- saldo a receber;
- pagamentos sem observações internas.

PDF do cliente não pode expor:

- custo terceirizado;
- repasse;
- margem/lucro;
- resultado estimado;
- eventos produtivos;
- observações internas de pagamento;
- detalhes administrativos.

PDF interno:

- identificação Gratão Flow;
- dados da OS ou Pedido de Cliente;
- cliente;
- itens e status;
- serviços;
- pagamentos com observações;
- eventos produtivos;
- terceirizações;
- custo terceirizado;
- repasse pago;
- repasse pendente;
- resultado estimado.

Não depender de navegador/headless browser para gerar PDF.

---

## Financeiro

Financeiro acompanha:

- contas a receber por OS;
- pagamentos de cliente;
- status financeiro da OS;
- repasses de terceirização;
- status de repasse;
- resumo financeiro;
- resultado estimado.

Pagamentos de cliente:

- pertencem à OS;
- são acumulativos;
- aceitam pagamento parcial;
- usam métodos `pix`, `cash`, `card`, `boleto`.

Não duplicar pagamento em Pedido de Cliente.

---

## Funcionários E Fechamento Semanal

Funcionários possuem:

- nome;
- função;
- telefone;
- diária;
- horas padrão;
- intervalo padrão;
- chave Pix;
- ativo/inativo.

Registro de ponto (`EmployeeWorkLog`):

- data;
- entrada;
- saída;
- intervalo;
- horas brutas;
- horas líquidas;
- horas normais;
- horas extras;
- modo de pagamento;
- tipo de trabalho;
- valores calculados;
- status de pagamento.

Fechamento semanal:

- vincula registros concluídos e pendentes de pagamento;
- bloqueia sobreposição de período para o mesmo funcionário;
- não fecha período com ponto aberto;
- calcula totais de horas, valores, descontos, adiantamentos e total a pagar;
- pode ser aberto, fechado ou pago;
- ao pagar fechamento, marca registros vinculados como pagos.

---

## Usuários E Segurança

Autenticação:

- login por `/auth/login`;
- JWT Bearer;
- rotas operacionais protegidas por usuário autenticado;
- rotas de usuários protegidas por admin.

Usuários:

- email;
- nome;
- senha hash;
- role;
- ativo/inativo;
- admin.

Configuração:

- `SECRET_KEY` obrigatória;
- `ADMIN_EMAIL` e `ADMIN_PASSWORD` obrigatórios para seed;
- em produção, docs/openapi/redoc são desativados;
- `CORS_ORIGINS` deve conter origens reais.

Sem acesso público para dados operacionais.

---

## API Principal

Prefixos registrados:

- `/auth`
- `/clients`
- `/deliveries`
- `/products`
- `/sizes`
- `/services`
- `/settings`
- `/outsourcers`
- `/employees`
- `/work-logs`
- `/order-groups`
- `/orders`
- `/stock`
- `/users`
- `/weekly-closings`

Endpoints de OS:

- `POST /orders`
- `GET /orders`
- `GET /orders/{order_id}`
- `PUT /orders/{order_id}`
- `DELETE /orders/{order_id}`
- `POST /orders/{order_id}/items/{item_id}/cancel`
- `POST /orders/{order_id}/pause-production`
- `POST /orders/{order_id}/resume-production`
- `POST /orders/{order_id}/payments`
- `POST /orders/{order_id}/cut`
- `POST /orders/{order_id}/print`
- `POST /orders/{order_id}/sew`
- `POST /orders/{order_id}/items/{item_id}/cut`
- `POST /orders/{order_id}/items/{item_id}/allocate-cut-pieces`
- `POST /orders/{order_id}/items/{item_id}/return-cut-pieces-to-stock`
- `POST /orders/{order_id}/items/{item_id}/print`
- `POST /orders/{order_id}/items/{item_id}/sew`
- `POST /orders/{order_id}/outsourcing`
- `GET /orders/{order_id}/outsourcings`
- `POST /orders/{order_id}/outsourcing/{outsourcing_id}/return`
- `POST /orders/{order_id}/outsourcing/{outsourcing_id}/payout`
- `POST /orders/{order_id}/items/{item_id}/loss`
- `POST /orders/{order_id}/items/{item_id}/rework`
- `POST /orders/{order_id}/items/{item_id}/adjustment`
- `GET /orders/{order_id}/items/{item_id}/operational-history`

Endpoints de Pedido de Cliente:

- `GET /order-groups`
- `POST /order-groups`
- `GET /order-groups/{group_id}`
- `PUT /order-groups/{group_id}`
- `DELETE /order-groups/{group_id}`
- `GET /order-groups/{group_id}/available-orders`
- `POST /order-groups/{group_id}/orders/{order_id}`
- `DELETE /order-groups/{group_id}/orders/{order_id}`
- `GET /order-groups/{group_id}/report/client`
- `GET /order-groups/{group_id}/report/internal`
- `GET /order-groups/{group_id}/report/client/pdf`
- `GET /order-groups/{group_id}/report/internal/pdf`

---

## Frontend

Layout autenticado com sidebar operacional.

Páginas principais:

- `/dashboard`
- `/clients`
- `/orders`
- `/orders/new`
- `/orders/[id]`
- `/order-groups`
- `/production`
- `/cutting`
- `/printing`
- `/sewing`
- `/outsourcing`
- `/deliveries`
- `/stock`
- `/finance`
- `/employees`
- `/users`
- `/reports`
- `/settings`

Diretrizes visuais:

- interface operacional, densa e clara;
- cards discretos;
- tabelas úteis;
- badges de status;
- botões com ícones quando adequado;
- nada de hero/landing page;
- não recriar PDF no frontend; sempre chamar endpoints do backend.

---

## Regras De Edição De OS

Ao criar OS:

- cliente obrigatório;
- pelo menos um item obrigatório;
- produto obrigatório por item;
- tamanho obrigatório por item;
- cor obrigatória por item;
- quantidade maior que zero;
- pelo menos um serviço por item;
- serviços duplicados no mesmo item são bloqueados.

Ao editar OS sem movimento:

- pode trocar cliente, itens, serviços, quantidades e observações;
- recalcula totais a partir dos itens e terceirizações ativas.

Ao editar OS com movimento:

- preservar rastreabilidade;
- itens movimentados não devem ser alterados de forma que invalide histórico;
- novos itens ainda podem ser adicionados;
- cliente só pode mudar se não quebrar vínculo com Pedido de Cliente;
- fechamento semanal fechado/pago bloqueia alteração financeira/produtiva da OS.

Ao cancelar item:

- não pode cancelar último item ativo;
- item sem movimento deve ser removido por edição;
- item entregue totalmente não deve ser cancelado sem fluxo de estorno;
- peças destinadas e ainda não comprometidas devem ser devolvidas ao estoque antes.

Ao apagar/cancelar OS:

- não apagar dados históricos indevidamente;
- preservar pagamentos, eventos e rastreabilidade conforme regra implementada;
- não apagar OS ao apagar Pedido de Cliente.

---

## Regras Técnicas

- Usar `Decimal` para dinheiro.
- Usar enums para status e tipos controlados.
- Validar dados no Pydantic e reforçar no backend.
- Backend deve ser stateless.
- Usar transações do SQLAlchemy e `with_for_update` quando houver concorrência de quantidade/estoque.
- Toda mudança de schema deve criar nova migration Alembic.
- Não editar migrations antigas.
- Não apagar dados existentes em migration.
- Não usar browser/headless para PDF.
- Evitar lógica financeira no frontend.
- Sempre sincronizar snapshots da OS após alterações de item/quantidade.
- Sempre atualizar financeiro após alteração de total ou pagamento.
- Eventos produtivos devem registrar usuário quando disponível.

---

## O Que Não Fazer

- Não voltar a proibir múltiplos produtos/modelos em uma OS.
- Não permitir quantidade negativa.
- Não deixar estoque negativo.
- Não misturar custo interno no PDF do cliente.
- Não expor repasse, custo terceirizado, margem ou eventos produtivos no relatório do cliente.
- Não duplicar pagamento entre OS e Pedido de Cliente.
- Não criar rateio automático complexo sem regra explícita.
- Não alterar preço de OS antiga por mudança no cadastro de serviço.
- Não pular validações produtivas.
- Não alterar produção de OS individual ao mexer no Pedido de Cliente.
- Não apagar OS ao excluir Pedido de Cliente.
- Não depender de dados calculados no frontend para persistência.

---

## Validação Recomendada

Depois de mudanças relevantes:

1. Rodar `npm run typecheck`.
2. Rodar `docker compose --env-file .env -f docker/docker-compose.yml up --build -d`.
3. Conferir containers com `docker compose --env-file .env -f docker/docker-compose.yml ps`.
4. Conferir logs do backend.
5. Validar criação de OS com múltiplos itens/produtos.
6. Validar campos obrigatórios de item.
7. Validar corte, alocação e devolução de peças.
8. Validar DTF com e sem exceção.
9. Validar confecção interna.
10. Validar terceirização, retorno e repasse.
11. Confirmar que terceirização vendida entra no total da OS.
12. Confirmar que custo terceirizado fica separado e afeta resultado estimado.
13. Validar pagamento parcial e total.
14. Validar Pedido de Cliente com duas ou mais OS do mesmo cliente.
15. Validar bloqueio de OS de outro cliente no Pedido de Cliente.
16. Validar bloqueio de OS já vinculada.
17. Validar desvinculação de OS.
18. Validar PDF do cliente sem dados internos.
19. Validar PDF interno com custos, repasses, eventos e resultado.
20. Validar entrega parcial e total.
21. Validar que OS individual continua funcionando após alterações agrupadas.

---

## Instrução Para O Codex

Sempre que executar tarefa neste projeto:

1. Ler este arquivo primeiro.
2. Conferir o código atual antes de assumir regra antiga.
3. Respeitar OS como unidade operacional e Pedido de Cliente como agrupador comercial/financeiro.
4. Lembrar que OS pode misturar produtos/modelos por itens.
5. Manter pagamentos na OS.
6. Manter terceirização vendida dentro do total cobrado da OS.
7. Manter custo/repasse terceirizado apenas em visões internas.
8. Preservar eventos e rastreabilidade.
9. Criar migrations novas quando alterar banco.
10. Validar com typecheck e Docker Compose quando houver alteração funcional.
