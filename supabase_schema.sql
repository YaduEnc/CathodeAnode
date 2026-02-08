-- Update Profiles Table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_searching BOOLEAN DEFAULT false;

-- Create Chats Table (Active Sessions)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  stage INTEGER DEFAULT 0, -- 0-5 Stage machine
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);

-- Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for Chats
CREATE POLICY "Users can see their own active chats." 
  ON public.chats FOR SELECT 
  USING ( auth.uid() = user1_id OR auth.uid() = user2_id );

CREATE POLICY "Users can create chats." 
  ON public.chats FOR INSERT 
  WITH CHECK ( auth.uid() = user1_id OR auth.uid() = user2_id );

-- Policies for Messages
CREATE POLICY "Users can see messages in their chats." 
  ON public.messages FOR SELECT 
  USING ( EXISTS (
    SELECT 1 FROM public.chats 
    WHERE id = chat_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
  ));

CREATE POLICY "Users can send messages to their chats." 
  ON public.messages FOR INSERT 
  WITH CHECK ( auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.chats 
    WHERE id = chat_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
  ));
