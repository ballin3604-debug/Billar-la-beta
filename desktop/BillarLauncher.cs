using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const int Port = 3001;
    private const string Url = "http://127.0.0.1:3001";

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();

        try
        {
            string baseDir = ResolveBaseDir();

            if (!IsServerReady())
            {
                if (IsPortOpen())
                {
                    // El servidor pudo quedar arrancando entre dos clics. Se le da
                    // unos segundos antes de asumir que el puerto es de otro programa.
                    if (!WaitForServer(TimeSpan.FromSeconds(10)))
                    {
                        MessageBox.Show(
                            "El puerto 3001 está ocupado por otro programa.\n\n" +
                            "Cierra ese programa o reinicia la computadora e intenta de nuevo.",
                            "Billar Bar la Beta",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        return;
                    }
                }
                else
                {
                    if (!File.Exists(Path.Combine(baseDir, "dist", "index.html")))
                    {
                        throw new Exception(
                            "Falta la interfaz compilada del sistema.\n\n" +
                            "Abre una consola en:\n" + baseDir + "\n\n" +
                            "y ejecuta una vez:\n  npm run build"
                        );
                    }

                    if (!File.Exists(Path.Combine(baseDir, "node_modules", "express", "package.json")))
                    {
                        throw new Exception(
                            "Faltan las dependencias del sistema.\n\n" +
                            "Abre una consola en:\n" + baseDir + "\n\n" +
                            "y ejecuta una vez:\n  npm install"
                        );
                    }

                    StartServer(baseDir);
                    if (!WaitForServer(TimeSpan.FromSeconds(40)))
                    {
                        MessageBox.Show(
                            "No se pudo iniciar el servidor local del sistema.\n\n" +
                            "Cierra el sistema y vuelve a abrirlo. Si el problema continúa, " +
                            "reinstala Billar Bar la Beta con el instalador original.",
                            "Billar Bar la Beta",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        return;
                    }
                }
            }

            OpenApp(baseDir);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                error.Message,
                "Billar Bar la Beta",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private static string ResolveBaseDir()
    {
        string[] starts =
        {
            AppDomain.CurrentDomain.BaseDirectory,
            Directory.GetCurrentDirectory(),
        };

        foreach (string start in starts)
        {
            try
            {
                string dir = start.TrimEnd(
                    Path.DirectorySeparatorChar,
                    Path.AltDirectorySeparatorChar
                );

                for (int depth = 0; depth < 4 && !String.IsNullOrEmpty(dir); depth++)
                {
                    if (File.Exists(Path.Combine(dir, "server", "index.mjs")))
                    {
                        return dir;
                    }

                    DirectoryInfo parent = Directory.GetParent(dir);
                    if (parent == null) break;
                    dir = parent.FullName;
                }
            }
            catch
            {
                // Prueba con la siguiente ubicación conocida.
            }
        }

        throw new Exception(
            "No se encontró la carpeta del sistema.\n\n" +
            "El lanzador debe estar junto a la carpeta del proyecto o dentro de ella."
        );
    }

    private static bool IsPortOpen()
    {
        try
        {
            using (var client = new TcpClient())
            {
                IAsyncResult result = client.BeginConnect("127.0.0.1", Port, null, null);
                if (!result.AsyncWaitHandle.WaitOne(700)) return false;
                client.EndConnect(result);
                return true;
            }
        }
        catch
        {
            return false;
        }
    }

    private static bool IsServerReady()
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(Url + "/api/health");
            request.Timeout = 1500;
            request.ReadWriteTimeout = 1500;
            request.Proxy = null;

            using (var response = (HttpWebResponse)request.GetResponse())
            {
                return response.StatusCode == HttpStatusCode.OK;
            }
        }
        catch
        {
            return false;
        }
    }

    private static void StartServer(string baseDir)
    {
        string node = FindNode(baseDir);
        if (node == null)
        {
            throw new Exception(
                "No se encontró el motor interno del sistema (runtime\\node.exe).\n\n" +
                "Vuelve a instalar Billar Bar la Beta con el instalador original."
            );
        }

        if (!File.Exists(Path.Combine(baseDir, "server", "index.mjs")))
        {
            throw new Exception(
                "No se encontró el sistema en esta carpeta:\n" + baseDir
            );
        }

        var info = new ProcessStartInfo
        {
            FileName = node,
            Arguments = "--disable-warning=ExperimentalWarning server/index.mjs",
            WorkingDirectory = baseDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        info.EnvironmentVariables["PORT"] = Port.ToString();
        info.EnvironmentVariables["HOST"] = "127.0.0.1";

        Process.Start(info);
    }

    private static string FindNode(string baseDir)
    {
        // El paquete del cliente incluye su propio Node para no depender de
        // nada instalado en la computadora.
        string bundled = Path.Combine(baseDir, "runtime", "node.exe");
        if (File.Exists(bundled)) return bundled;

        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        string[] candidates =
        {
            Path.Combine(programFiles, "nodejs", "node.exe"),
            Path.Combine(programFilesX86, "nodejs", "node.exe"),
            Path.Combine(localAppData, "Programs", "nodejs", "node.exe"),
        };

        foreach (string candidate in candidates)
        {
            if (File.Exists(candidate)) return candidate;
        }

        string path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (string directory in path.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                string candidate = Path.Combine(directory.Trim('"'), "node.exe");
                if (File.Exists(candidate)) return candidate;
            }
            catch
            {
                // Ignora rutas inválidas del PATH.
            }
        }

        return null;
    }

    private static bool WaitForServer(TimeSpan timeout)
    {
        DateTime limit = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < limit)
        {
            if (IsServerReady()) return true;
            Thread.Sleep(400);
        }
        return false;
    }

    private static void OpenApp(string baseDir)
    {
        // Permite probar el lanzador sin abrir una ventana del navegador.
        if (Environment.GetEnvironmentVariable("BILLAR_NO_BROWSER") == "1") return;

        string browser = FindBrowser();
        if (browser != null)
        {
            var info = new ProcessStartInfo
            {
                FileName = browser,
                Arguments =
                    "--app=" + Url +
                    " --start-maximized" +
                    " --no-first-run" +
                    " --no-default-browser-check",
                WorkingDirectory = baseDir,
                UseShellExecute = false,
            };
            Process.Start(info);
            return;
        }

        // Último recurso: abrir con el navegador predeterminado.
        Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true });
    }

    private static string FindBrowser()
    {
        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        string[] candidates =
        {
            Path.Combine(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
        };

        foreach (string candidate in candidates)
        {
            if (File.Exists(candidate)) return candidate;
        }

        return null;
    }
}
