# ============================================================================
# Bolinho de Chuva — receita para a hospedagem (Render)
# ----------------------------------------------------------------------------
# Não precisa mexer aqui. O Render lê este arquivo e monta o sistema sozinho:
#   1. compila o programa em C# (pasta backend);
#   2. coloca o site (pasta frontend) junto dele;
#   3. liga tudo num endereço só.
# ============================================================================

# ---------- 1. Compilar ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS compilar
WORKDIR /src
COPY backend/BolinhoDeChuva.Api.csproj backend/
RUN dotnet restore backend/BolinhoDeChuva.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/BolinhoDeChuva.Api.csproj -c Release -o /app --no-restore

# ---------- 2. Rodar ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=compilar /app .
COPY frontend ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_CLI_TELEMETRY_OPTOUT=1

ENTRYPOINT ["dotnet", "BolinhoDeChuva.Api.dll"]
