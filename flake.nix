{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.llog = pkgs.buildNpmPackage {
          pname = "llog";
          version = "0.1.0";
          src = self;
          npmDepsHash = "sha256-YQBKm7oYqD22nimITtsonIo2XQaVqLfYEO+F2aBOIOs=";
          nativeBuildInputs = [ pkgs.nodePackages.typescript ];
          buildPhase = "tsc";
        };
      }
    ) // {
      nixosModules.default = { config, lib, pkgs, ... }:
        {
          options.services.llog = {
            enable = lib.mkEnableOption "llog service";
            config = lib.mkOption {
              type = lib.types.attrs;
              default = { };
              description = "Configuration JSON object for llog";
            };
          };

          config = lib.mkIf config.services.llog.enable (let
            cfg = config.services.llog;
            package = self.packages.${pkgs.stdenv.hostPlatform.system}.llog;
            configFile = pkgs.writeText "llog-config.json" (builtins.toJSON cfg.config);
          in {
            systemd.services.llog = {
              description = "llog service";
              wantedBy = [ "multi-user.target" ];
              serviceConfig = {
                ExecStart = "${pkgs.nodejs}/bin/node ${package}/lib/node_modules/llog/build/index.js";
                WorkingDirectory = "${package}/lib/node_modules/llog";
                Restart = "always";
                DynamicUser = true;
              };
              environment = {
                CONFIG_FILE = "${configFile}";
              };
            };
          });
        };
    };
}