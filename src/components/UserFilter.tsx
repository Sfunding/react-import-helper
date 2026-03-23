import { useProfiles } from '@/hooks/useProfiles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users } from 'lucide-react';

interface UserFilterProps {
  value: string; // 'all' | 'mine' | a user_id
  onChange: (value: string) => void;
}

export function UserFilter({ value, onChange }: UserFilterProps) {
  const { profiles, isLoading } = useProfiles();

  return (
    <div className="flex items-center gap-2">
      <Users className="w-4 h-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by user" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          <SelectItem value="mine">My Deals</SelectItem>
          {!isLoading && profiles.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              {profile.full_name || profile.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
