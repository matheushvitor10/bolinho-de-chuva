# ============================================================================
# Bolinho de Chuva — receita para a hospedagem (Render)
# ----------------------------------------------------------------------------
# O Render lê este arquivo e monta o sistema sozinho:
#   1. compila a API em C#;
#   2. junta o site (HTML, CSS, JS) dentro da API;
#   3. liga tudo num endereço só (ex.: https://bolinho-de-chuva.onrender.com).
# Não precisa rodar nada disso no seu computador.
# ============================================================================

# ---------- 1. Compilar ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS compilar
WORKDIR /src
COPY backend/BolinhoDeChuva.Api/BolinhoDeChuva.Api.csproj backend/BolinhoDeChuva.Api/
RUN dotnet restore backend/BolinhoDeChuva.Api/BolinhoDeChuva.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/BolinhoDeChuva.Api/BolinhoDeChuva.Api.csproj -c Release -o /app --no-restore

# ---------- 2. Rodar ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=compilar /app .
COPY frontend/BolinhoDeChuva.Web/wwwroot ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    TZ=America/Sao_Paulo

ENTRYPOINT ["dotnet", "BolinhoDeChuva.Api.dll"]
