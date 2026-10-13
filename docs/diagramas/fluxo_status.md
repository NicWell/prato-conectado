# Ciclo de vida da doação (proposta)

```mermaid
stateDiagram-v2
    [*] --> RASCUNHO : criar oferta
    RASCUNHO --> DISPONIVEL : termo aceito + triagem DOADOR apta + itens validos
    RASCUNHO --> CANCELADA : cancelar
    DISPONIVEL --> RESERVADA : aceitar solicitacao da ONG
    DISPONIVEL --> CANCELADA : cancelamento do doador
    DISPONIVEL --> ENCERRADA : limite expirado
    RESERVADA --> RETIRADA : confirmar coleta
    RESERVADA --> CANCELADA : cancelamento permitido pela regra futura
    RESERVADA --> ENCERRADA : prazo expirado sem retirada
    RETIRADA --> ENTREGUE : checklist ONG apto + confirmar recebimento
    RETIRADA --> CANCELADA : ocorrencia / validacao manual
    ENTREGUE --> [*]
    CANCELADA --> [*]
    ENCERRADA --> [*]
```

**Observação:** os estados e as transições são proposta de implementação para HU06/HU07/HU09. O prazo automático de encerramento exige processo agendado no backend; um `CHECK` SQL não consegue fazê-lo sozinho.
