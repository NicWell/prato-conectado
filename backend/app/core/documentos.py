"""Validação matemática; não consulta situação cadastral na Receita Federal."""
import re


def normalizar_cpf(valor: str) -> str:
    valor = valor.strip()
    if not re.fullmatch(r"(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})", valor):
        raise ValueError("CPF deve ter 11 dígitos, com ou sem máscara.")
    cpf = valor.replace(".", "").replace("-", "")
    if len(set(cpf)) == 1:
        raise ValueError("CPF inválido.")
    for tamanho in (9, 10):
        soma = sum(int(n) * peso for n, peso in zip(cpf[:tamanho], range(tamanho + 1, 1, -1)))
        digito = (soma * 10 % 11) % 10
        if digito != int(cpf[tamanho]):
            raise ValueError("CPF inválido.")
    return cpf


def normalizar_cnpj(valor: str) -> str:
    valor = valor.strip().upper()
    if not re.fullmatch(r"(?:[A-Z0-9]{12}[0-9]{2}|[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2})", valor):
        raise ValueError("CNPJ deve ter 12 caracteres alfanuméricos e 2 dígitos verificadores.")
    cnpj = valor.replace(".", "").replace("/", "").replace("-", "")
    if len(set(cnpj)) == 1:
        raise ValueError("CNPJ inválido.")
    for tamanho, pesos in ((12, (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)),
                           (13, (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2))):
        resto = sum((ord(n) - 48) * peso for n, peso in zip(cnpj[:tamanho], pesos)) % 11
        if (0 if resto < 2 else 11 - resto) != int(cnpj[tamanho]):
            raise ValueError("CNPJ inválido.")
    return cnpj
