// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'SysAdmin Labs',
			description: 'Laboratorios progresivos de SysAdmin: Windows Server, AD, DNS, DHCP, networking, scripting, cloud y Linux.',
			defaultLocale: 'es',
			locales: {
				root: {
					label: 'Español',
					lang: 'es',
				},
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' },
			],
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Inicio',
					items: [
						{ label: 'Bienvenida', slug: 'index' },
						{ label: 'Arquitectura y Ruta', slug: 'arquitectura' },
						{ label: '🎤 Banco de Preguntas', slug: 'preguntas' },
					],
				},
				{
					label: 'Preparación del Entorno',
					collapsed: false,
					items: [
						{ label: 'VirtualBox: Configuración Base', slug: 'setup/virtualbox-base' },
						{ label: 'VM: Windows Server 2022', slug: 'setup/vm-windows-server' },
						{ label: 'VM: Windows 11 (Clientes)', slug: 'setup/vm-windows-11' },
					],
				},
				{
					label: 'Fase 1 — Active Directory y GPO',
					collapsed: false,
					items: [
						{ label: 'Lab 01: AD + GPO', slug: 'labs/lab-01-ad-gpo' },
						{ label: 'Lab 02: GPO Avanzado', slug: 'labs/lab-02-gpo-avanzado' },
						{ label: 'Lab 03: Grupos y RBAC', slug: 'labs/lab-03-grupos-rbac' },
						{ label: 'Lab 04: Usuarios Avanzado', slug: 'labs/lab-04-usuarios-avanzado' },
					],
				},
				{
					label: 'Fase 2 — Servicios de Red Windows Server',
					collapsed: false,
					items: [
						{ label: 'Lab DNS: Windows DNS Server', slug: 'redes/win-dns' },
						{ label: 'Lab DHCP: Windows DHCP Server', slug: 'redes/win-dhcp' },
					],
				},
				{
					label: 'Fase 3 — Networking',
					collapsed: false,
					items: [
						{ label: 'NET-01: OSI y Diagnóstico', slug: 'redes/net-01-osi-diagnostico' },
						{ label: 'NET-02: VLANs', slug: 'redes/net-02-vlans' },
						{ label: 'NET-03: Wi-Fi y SSIDs', slug: 'redes/net-03-wifi-ssid' },
						{ label: 'NET-04: Firewalls', slug: 'redes/net-04-firewalls' },
					],
				},
				{
					label: 'Fase 4 — Dominio Híbrido y Cloud',
					collapsed: false,
					items: [
						{ label: 'Híbrido: AD + Entra ID', slug: 'hibrido/hibrido-entra' },
						{ label: 'Cloud: AWS Fundamentos', slug: 'cloud/cloud-aws' },
						{ label: 'Cloud: Azure Fundamentos', slug: 'cloud/cloud-azure' },
					],
				},
				{
					label: 'Fase 5 — SCCM / MECM',
					collapsed: true,
					items: [
						{ label: 'Lab 05: Instalación SCCM', slug: 'labs/lab-05-sccm-instalacion' },
						{ label: 'Lab 06: Despliegue Software', slug: 'labs/lab-06-sccm-software' },
						{ label: 'Lab 07: Patch Management', slug: 'labs/lab-07-sccm-patches' },
						{ label: 'Lab 08: OSD y Task Seq.', slug: 'labs/lab-08-sccm-osd' },
					],
				},
				{
					label: 'Fase 6 — Scripting y Automatización',
					collapsed: false,
					items: [
						{ label: 'Script: PowerShell', slug: 'scripting/ps-powershell' },
						{ label: 'Script: Bash', slug: 'scripting/bash-scripting' },
					],
				},
				{
					label: 'Fase 7 — Operaciones',
					collapsed: false,
					items: [
						{ label: 'Ops: Monitoreo', slug: 'ops/ops-monitoreo' },
						{ label: 'Ops: Backups y Rollback', slug: 'ops/ops-backups' },
						{ label: 'Ops: ITIL v4', slug: 'ops/ops-itil' },
					],
				},
				{
					label: 'Fase 8 — Linux',
					collapsed: false,
					items: [
						{ label: 'Linux: Administración', slug: 'linux/linux-administracion' },
					],
				},
			],
		}),
	],
});
