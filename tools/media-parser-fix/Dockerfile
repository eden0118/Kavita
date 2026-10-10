FROM jvmilazz0/kavita@sha256:31181a32f0dda73cae68721867028a7253d57881b58bea5754cd9e578e75421a AS original
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS patch
WORKDIR /patch
COPY Patch.csproj Program.cs ./
COPY --from=original /kavita/*.dll /input/
RUN dotnet run --project Patch.csproj --configuration Release -- /input/Kavita.Services.dll /patch/Kavita.Services.dll
FROM original
COPY --from=patch /patch/Kavita.Services.dll /kavita/Kavita.Services.dll
