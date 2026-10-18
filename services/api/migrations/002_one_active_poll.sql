create unique index one_active_poll_per_room on polls (room_id) where status = 'active';
