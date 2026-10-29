import { notFound } from 'next/navigation';
import { Command } from '@/components/command';
import { modules, isWorkspace } from '@/lib/modules';

export async function generateMetadata({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  if (!isWorkspace(workspace)) return {};
  const title =
    workspace === 'reports'
      ? 'Intelligence reports'
      : workspace === 'settings'
        ? 'System settings'
        : 'AETHER ' + workspace.toUpperCase();
  return { title };
}

export function generateStaticParams() {
  return [
    ...modules.filter((m) => m.id !== 'command').map((m) => ({ workspace: m.id })),
    { workspace: 'reports' },
    { workspace: 'settings' },
    { workspace: 'response' },
    { workspace: 'geo' },
  ];
}
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ incident?: string }>;
}) {
  const { workspace } = await params;
  if (!isWorkspace(workspace)) notFound();
  const { incident } = await searchParams;
  return (
    <Command
      workspace={workspace}
      incidentId={typeof incident === 'string' ? incident : undefined}
    />
  );
}
