FROM kavita-local:0.9.1.4-media-parser-fix
LABEL org.opencontainers.image.title="Kavita 0.9.1.4 mobile reader backport"
LABEL org.opencontainers.image.version="0.9.1.4-mobile-reader-20261014"
LABEL org.opencontainers.image.source="https://github.com/Kareadita/Kavita/tree/879b8b73eb41d66f88dde8eb874cc99a3397eb11"
RUN echo "b22af185577f313b3def8d442f2b12df1f389f2f7bb5caa641ade4fef63d6547  /kavita/Kavita.Services.dll" | sha256sum -c - \
 && echo "344f8685ef15a1a08ae7590c161faf58ef118f8d77161b449b52f50971b06b7f  /kavita/Kavita.Server.dll" | sha256sum -c -
# Remove old hashed bundles so stale files cannot be served after deployment.
RUN rm -rf /kavita/wwwroot
COPY .build/wwwroot /kavita/wwwroot
COPY .build/wwwroot.sha256 /tmp/kavita-wwwroot.sha256
WORKDIR /kavita/wwwroot
RUN sha256sum --quiet -c /tmp/kavita-wwwroot.sha256
WORKDIR /kavita
