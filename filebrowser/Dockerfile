FROM filebrowser/filebrowser:v2.32.0

WORKDIR /

COPY filebrowser.json /.filebrowser.json
COPY branding /branding

RUN /filebrowser config init
RUN /filebrowser users add student ''
RUN /filebrowser config set --branding.name "Fišingo Dropbox" --branding.files "/branding" --branding.disableExternal --branding.theme "dark"
RUN /filebrowser config set --auth.method=noauth
