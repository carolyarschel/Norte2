--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: cadence_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cadence_type AS ENUM (
    'weekly',
    'biweekly_odd',
    'biweekly_even'
);


--
-- Name: consultant_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consultant_level AS ENUM (
    'junior',
    'pleno',
    'senior'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'confirmed',
    'hot',
    'cold',
    'archived'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public._migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- Name: allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allocations (
    id integer NOT NULL,
    project_id integer NOT NULL,
    consultant_id integer NOT NULL,
    weekday integer NOT NULL,
    role character varying(20) DEFAULT 'consultor'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT allocations_weekday_check CHECK (((weekday >= 1) AND (weekday <= 5)))
);


--
-- Name: consultants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultants (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    level public.consultant_level DEFAULT 'junior'::public.consultant_level NOT NULL,
    is_leader boolean DEFAULT false NOT NULL,
    max_days integer DEFAULT 5 NOT NULL,
    restrictions integer[] DEFAULT '{}'::integer[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consultants_max_days_check CHECK (((max_days >= 1) AND (max_days <= 5)))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    acronym character varying(5) NOT NULL,
    client character varying(200) NOT NULL,
    status public.project_status DEFAULT 'cold'::public.project_status NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    cadence public.cadence_type DEFAULT 'weekly'::public.cadence_type NOT NULL,
    visit_days integer[] DEFAULT '{}'::integer[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    leader_consultant_id integer,
    CONSTRAINT chk_dates CHECK ((end_date >= start_date))
);


--
-- Name: allocations_detail; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.allocations_detail AS
 SELECT a.id AS allocation_id,
    a.weekday,
    a.role,
    p.id AS project_id,
    p.acronym AS project_acronym,
    p.client AS project_client,
    p.status AS project_status,
    p.cadence,
    p.start_date,
    p.end_date,
    c.id AS consultant_id,
    c.name AS consultant_name,
    c.level AS consultant_level,
    c.is_leader AS consultant_is_leader,
    c.max_days AS consultant_max_days
   FROM ((public.allocations a
     JOIN public.projects p ON ((a.project_id = p.id)))
     JOIN public.consultants c ON ((a.consultant_id = c.id)));


--
-- Name: allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.allocations_id_seq OWNED BY public.allocations.id;


--
-- Name: consultants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consultants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consultants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consultants_id_seq OWNED BY public.consultants.id;


--
-- Name: level_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.level_slots (
    id integer NOT NULL,
    project_id integer NOT NULL,
    level public.consultant_level NOT NULL,
    is_leader boolean DEFAULT false NOT NULL,
    days_per_week integer NOT NULL,
    visit_days integer[] DEFAULT '{}'::integer[] NOT NULL,
    assigned_consultant_id integer,
    assigned_days integer[] DEFAULT '{}'::integer[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT level_slots_days_per_week_check CHECK (((days_per_week >= 1) AND (days_per_week <= 5)))
);


--
-- Name: level_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.level_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: level_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.level_slots_id_seq OWNED BY public.level_slots.id;


--
-- Name: pinned_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pinned_slots (
    id integer NOT NULL,
    project_id integer NOT NULL,
    consultant_id integer NOT NULL,
    days_per_week integer NOT NULL,
    visit_days integer[] DEFAULT '{}'::integer[] NOT NULL,
    assigned_days integer[] DEFAULT '{}'::integer[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cadence public.cadence_type,
    CONSTRAINT pinned_slots_days_per_week_check CHECK (((days_per_week >= 1) AND (days_per_week <= 5)))
);


--
-- Name: pinned_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pinned_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pinned_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pinned_slots_id_seq OWNED BY public.pinned_slots.id;


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations ALTER COLUMN id SET DEFAULT nextval('public.allocations_id_seq'::regclass);


--
-- Name: consultants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultants ALTER COLUMN id SET DEFAULT nextval('public.consultants_id_seq'::regclass);


--
-- Name: level_slots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_slots ALTER COLUMN id SET DEFAULT nextval('public.level_slots_id_seq'::regclass);


--
-- Name: pinned_slots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_slots ALTER COLUMN id SET DEFAULT nextval('public.pinned_slots_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Data for Name: _migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._migrations (id, filename, applied_at) FROM stdin;
1	001_create_consultants.sql	2026-05-28 15:10:05.392069-03
2	002_create_projects.sql	2026-05-28 15:10:05.418577-03
3	003_create_allocations.sql	2026-05-28 15:10:05.462466-03
4	004_add_leader_to_projects.sql	2026-06-01 14:47:35.167119-03
5	005_add_cadence_to_pinned_slots.sql	2026-06-01 15:20:37.211354-03
\.


--
-- Data for Name: allocations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.allocations (id, project_id, consultant_id, weekday, role, created_at) FROM stdin;
187	24	18	4	consultor	2026-06-01 11:12:35.23184-03
188	24	18	3	consultor	2026-06-01 11:12:35.23184-03
189	24	10	3	lider	2026-06-01 11:12:35.23184-03
190	24	10	4	lider	2026-06-01 11:12:35.23184-03
193	29	13	2	lider	2026-06-01 13:43:31.29174-03
194	29	21	2	consultor	2026-06-01 13:43:31.29174-03
195	29	21	3	consultor	2026-06-01 13:43:31.29174-03
196	29	19	2	consultor	2026-06-01 13:43:31.29174-03
204	11	10	2	lider	2026-06-01 14:43:03.900295-03
205	11	10	1	lider	2026-06-01 14:43:03.900295-03
206	11	11	2	lider	2026-06-01 14:43:03.900295-03
207	11	11	1	lider	2026-06-01 14:43:03.900295-03
208	28	11	5	lider	2026-06-01 14:53:06.887154-03
209	28	11	4	lider	2026-06-01 14:53:06.887154-03
210	28	11	3	lider	2026-06-01 14:53:06.887154-03
211	28	13	3	lider	2026-06-01 14:53:06.887154-03
39	12	12	1	lider	2026-06-01 10:07:06.945381-03
40	12	12	3	lider	2026-06-01 10:07:06.945381-03
41	12	15	1	lider	2026-06-01 10:07:06.945381-03
42	12	15	3	lider	2026-06-01 10:07:06.945381-03
212	28	13	4	lider	2026-06-01 14:53:06.887154-03
213	28	13	5	lider	2026-06-01 14:53:06.887154-03
46	14	12	2	lider	2026-06-01 10:07:10.078855-03
47	15	15	5	lider	2026-06-01 10:07:11.299201-03
48	15	18	2	consultor	2026-06-01 10:07:11.299201-03
49	15	18	5	consultor	2026-06-01 10:07:11.299201-03
50	16	14	2	lider	2026-06-01 10:07:12.446684-03
51	16	20	2	consultor	2026-06-01 10:07:12.446684-03
52	16	20	5	consultor	2026-06-01 10:07:12.446684-03
53	17	10	5	lider	2026-06-01 10:07:13.335922-03
54	17	16	3	consultor	2026-06-01 10:07:13.335922-03
55	17	16	5	consultor	2026-06-01 10:07:13.335922-03
56	18	12	4	lider	2026-06-01 10:07:14.58958-03
57	18	12	5	lider	2026-06-01 10:07:14.58958-03
58	18	14	4	lider	2026-06-01 10:07:14.58958-03
59	18	14	5	lider	2026-06-01 10:07:14.58958-03
60	18	17	4	consultor	2026-06-01 10:07:14.58958-03
61	18	17	5	consultor	2026-06-01 10:07:14.58958-03
64	22	18	3	consultor	2026-06-01 10:12:47.70785-03
65	22	18	4	consultor	2026-06-01 10:12:47.70785-03
72	25	15	4	lider	2026-06-01 10:14:55.634678-03
163	26	17	2	consultor	2026-06-01 10:46:44.195419-03
164	26	17	1	consultor	2026-06-01 10:46:44.195419-03
175	13	13	1	lider	2026-06-01 11:07:02.217319-03
176	13	16	1	consultor	2026-06-01 11:07:02.217319-03
177	13	16	2	consultor	2026-06-01 11:07:02.217319-03
239	20	14	1	lider	2026-06-01 15:29:40.644622-03
240	20	14	3	lider	2026-06-01 15:29:40.644622-03
241	20	10	3	lider	2026-06-01 15:29:40.644622-03
242	20	10	4	lider	2026-06-01 15:29:40.644622-03
243	20	15	2	lider	2026-06-01 15:29:40.644622-03
\.


--
-- Data for Name: consultants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.consultants (id, name, level, is_leader, max_days, restrictions, created_at, updated_at) FROM stdin;
10	Bini	senior	t	5	{}	2026-06-01 09:41:42.879229-03	2026-06-01 09:41:42.879229-03
11	Gui	senior	t	5	{}	2026-06-01 09:41:50.767536-03	2026-06-01 09:41:50.767536-03
12	Sam	senior	t	5	{}	2026-06-01 09:41:58.257155-03	2026-06-01 09:41:58.257155-03
13	Rafa	senior	t	5	{}	2026-06-01 09:42:04.387605-03	2026-06-01 09:42:04.387605-03
14	Zem	senior	t	5	{}	2026-06-01 09:42:12.280395-03	2026-06-01 09:42:12.280395-03
15	Hugo	pleno	t	5	{}	2026-06-01 09:42:19.237955-03	2026-06-01 09:42:19.237955-03
16	Lara	junior	f	5	{}	2026-06-01 09:42:24.852906-03	2026-06-01 09:42:24.852906-03
17	Bernardo	junior	f	5	{}	2026-06-01 09:42:33.346058-03	2026-06-01 09:42:33.346058-03
18	Enzo	junior	f	5	{}	2026-06-01 09:42:40.214746-03	2026-06-01 09:42:40.214746-03
19	Carol	junior	f	5	{}	2026-06-01 09:42:44.83938-03	2026-06-01 09:42:44.83938-03
20	Moretti	senior	f	2	{1,3,4}	2026-06-01 09:43:12.422623-03	2026-06-01 09:43:12.422623-03
21	Anthony	pleno	f	2	{1,4,5}	2026-06-01 09:43:26.543741-03	2026-06-01 14:36:34.537384-03
\.


--
-- Data for Name: level_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.level_slots (id, project_id, level, is_leader, days_per_week, visit_days, assigned_consultant_id, assigned_days, created_at) FROM stdin;
23	26	pleno	t	1	{}	\N	{}	2026-06-01 10:46:44.181524-03
31	19	senior	t	1	{}	\N	{}	2026-06-01 12:08:17.191755-03
32	21	pleno	t	1	{}	\N	{}	2026-06-01 14:28:35.67048-03
33	21	junior	f	2	{}	\N	{}	2026-06-01 14:28:35.67048-03
\.


--
-- Data for Name: pinned_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pinned_slots (id, project_id, consultant_id, days_per_week, visit_days, assigned_days, created_at, cadence) FROM stdin;
145	20	14	2	{3,1}	{1,3}	2026-06-01 15:29:40.619262-03	weekly
146	20	15	1	{}	{2}	2026-06-01 15:29:40.619262-03	weekly
147	20	10	2	{4,3}	{3,4}	2026-06-01 15:29:40.619262-03	biweekly_odd
10	12	12	2	{3,1}	{1,3}	2026-06-01 09:46:09.843689-03	\N
11	12	15	2	{3,1}	{1,3}	2026-06-01 09:46:09.847254-03	\N
117	24	18	2	{4,3}	{3,4}	2026-06-01 11:12:35.205335-03	\N
118	24	10	2	{3,4}	{3,4}	2026-06-01 11:12:35.205335-03	\N
14	14	12	1	{2}	{2}	2026-06-01 09:47:34.228995-03	\N
15	15	15	1	{5}	{5}	2026-06-01 09:48:26.772702-03	\N
16	15	18	2	{2,5}	{2,5}	2026-06-01 09:48:26.775559-03	\N
17	16	14	1	{2}	{2}	2026-06-01 09:49:45.305695-03	\N
18	16	20	2	{2,5}	{2,5}	2026-06-01 09:49:45.309382-03	\N
19	17	10	1	{5}	{5}	2026-06-01 09:51:17.120385-03	\N
20	17	16	2	{2,5}	{3,5}	2026-06-01 09:51:17.123361-03	\N
21	18	12	2	{4,5}	{4,5}	2026-06-01 09:53:09.438363-03	\N
22	18	17	2	{4,5}	{4,5}	2026-06-01 09:53:09.442243-03	\N
23	18	14	2	{4,5}	{4,5}	2026-06-01 09:53:09.442839-03	\N
26	22	18	2	{3,4}	{3,4}	2026-06-01 10:12:47.70072-03	\N
88	26	17	2	{2,1}	{1,2}	2026-06-01 10:46:44.186118-03	\N
31	25	15	1	{4}	{4}	2026-06-01 10:14:55.631387-03	\N
93	27	14	1	{}	{}	2026-06-01 10:50:21.801195-03	\N
108	13	13	1	{1}	{1}	2026-06-01 11:07:02.139634-03	\N
109	13	16	2	{1,3}	{1,2}	2026-06-01 11:07:02.139634-03	\N
122	19	15	1	{}	{}	2026-06-01 12:08:17.191755-03	\N
94	29	13	1	{2}	{2}	2026-06-01 10:54:46.752712-03	\N
95	29	21	2	{2,3}	{2,3}	2026-06-01 10:54:46.762326-03	\N
96	29	19	1	{2}	{2}	2026-06-01 10:54:46.76433-03	\N
123	11	10	2	{2,1}	{1,2}	2026-06-01 14:43:03.870239-03	\N
124	11	11	2	{2,1}	{1,2}	2026-06-01 14:43:03.870239-03	\N
125	28	11	3	{5,4,3}	{3,4,5}	2026-06-01 14:53:06.869558-03	\N
126	28	13	3	{3,4,5}	{3,4,5}	2026-06-01 14:53:06.869558-03	\N
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, acronym, client, status, start_date, end_date, cadence, visit_days, created_at, updated_at, leader_consultant_id) FROM stdin;
21	3GF	3G Foods	hot	2026-07-06	2027-02-12	weekly	{}	2026-06-01 10:11:00.590808-03	2026-06-01 14:28:35.67048-03	\N
20	LDC	LDC Café	confirmed	2026-07-06	2027-06-06	biweekly_odd	{1,2,3,4}	2026-06-01 10:09:57.447732-03	2026-06-01 15:30:27.663296-03	\N
11	GEV	General Electric Vernova	confirmed	2026-03-02	2027-02-23	weekly	{1,2}	2026-06-01 09:45:07.743765-03	2026-06-01 14:50:03.459719-03	10
12	VUL	Vulkan	confirmed	2025-10-06	2026-12-16	weekly	{1,3}	2026-06-01 09:46:09.841407-03	2026-06-01 14:50:08.729999-03	12
26	IMC	Grupo IMC	hot	2026-07-06	2026-11-13	weekly	{1,2}	2026-06-01 10:46:44.148687-03	2026-06-01 10:46:44.195419-03	\N
13	INF	Infibra	confirmed	2026-03-03	2026-08-25	weekly	{1,2}	2026-06-01 09:46:57.464459-03	2026-06-01 14:50:13.675188-03	13
14	TEC	Tecnotam	confirmed	2025-09-29	2026-06-30	weekly	{2}	2026-06-01 09:47:34.227527-03	2026-06-01 14:50:15.342857-03	12
15	ENG	Engetubo - Lean	confirmed	2026-02-10	2026-08-28	weekly	{2,5}	2026-06-01 09:48:26.77098-03	2026-06-01 14:50:18.008685-03	15
16	ENG	Engetubo - Armazem	confirmed	2026-04-14	2026-09-15	weekly	{2,5}	2026-06-01 09:49:45.303002-03	2026-06-01 14:50:21.1327-03	14
27	LIE	Lindsay - Exportação	hot	2026-07-06	2026-08-10	weekly	{}	2026-06-01 10:48:18.651478-03	2026-06-01 10:50:21.801195-03	\N
17	VEI	Veiling	confirmed	2026-02-27	2026-08-28	weekly	{3,5}	2026-06-01 09:51:17.11696-03	2026-06-01 14:50:24.084737-03	10
18	IND	Induscabos	confirmed	2025-10-02	2027-05-21	weekly	{4,5}	2026-06-01 09:53:09.436607-03	2026-06-01 14:50:27.784637-03	12
24	GEL	Gelita - Manutenção	confirmed	2025-04-29	2027-12-16	biweekly_even	{3,4}	2026-06-01 10:14:14.289593-03	2026-06-01 14:50:34.185741-03	10
25	VIA	Via Sudeste	confirmed	2026-03-26	2026-10-08	weekly	{4}	2026-06-01 10:14:55.629842-03	2026-06-01 14:50:36.241049-03	15
29	CON	Conecta Cargo	confirmed	2026-06-02	2026-11-25	weekly	{2,3}	2026-06-01 10:54:46.745724-03	2026-06-01 14:50:52.124472-03	13
22	GEL	Gelita - Retag	confirmed	2025-12-01	2026-08-27	biweekly_odd	{3,4}	2026-06-01 10:12:47.698989-03	2026-06-01 10:12:47.70785-03	\N
28	SAD	Sada	hot	2026-08-10	2026-12-26	weekly	{3,4,5}	2026-06-01 10:49:12.219813-03	2026-06-01 14:53:06.887154-03	13
19	LIA	Lindsay - SOP/E	hot	2026-07-06	2026-08-06	weekly	{}	2026-06-01 10:08:43.815008-03	2026-06-01 12:08:17.191755-03	\N
\.


--
-- Name: _migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public._migrations_id_seq', 5, true);


--
-- Name: allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.allocations_id_seq', 243, true);


--
-- Name: consultants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.consultants_id_seq', 21, true);


--
-- Name: level_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.level_slots_id_seq', 33, true);


--
-- Name: pinned_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pinned_slots_id_seq', 147, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_id_seq', 33, true);


--
-- Name: _migrations _migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_filename_key UNIQUE (filename);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_consultant_id_weekday_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_consultant_id_weekday_project_id_key UNIQUE (consultant_id, weekday, project_id);


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: consultants consultants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultants
    ADD CONSTRAINT consultants_pkey PRIMARY KEY (id);


--
-- Name: level_slots level_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_slots
    ADD CONSTRAINT level_slots_pkey PRIMARY KEY (id);


--
-- Name: pinned_slots pinned_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_slots
    ADD CONSTRAINT pinned_slots_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: idx_allocations_consultant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_consultant ON public.allocations USING btree (consultant_id);


--
-- Name: idx_allocations_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_project ON public.allocations USING btree (project_id);


--
-- Name: idx_allocations_weekday; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_weekday ON public.allocations USING btree (weekday);


--
-- Name: idx_consultants_is_leader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultants_is_leader ON public.consultants USING btree (is_leader);


--
-- Name: idx_consultants_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultants_level ON public.consultants USING btree (level);


--
-- Name: idx_level_slots_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_level_slots_project ON public.level_slots USING btree (project_id);


--
-- Name: idx_pinned_slots_consultant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pinned_slots_consultant ON public.pinned_slots USING btree (consultant_id);


--
-- Name: idx_pinned_slots_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pinned_slots_project ON public.pinned_slots USING btree (project_id);


--
-- Name: idx_projects_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_dates ON public.projects USING btree (start_date, end_date);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: allocations allocations_consultant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_consultant_id_fkey FOREIGN KEY (consultant_id) REFERENCES public.consultants(id) ON DELETE CASCADE;


--
-- Name: allocations allocations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: level_slots level_slots_assigned_consultant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_slots
    ADD CONSTRAINT level_slots_assigned_consultant_id_fkey FOREIGN KEY (assigned_consultant_id) REFERENCES public.consultants(id) ON DELETE SET NULL;


--
-- Name: level_slots level_slots_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_slots
    ADD CONSTRAINT level_slots_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: pinned_slots pinned_slots_consultant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_slots
    ADD CONSTRAINT pinned_slots_consultant_id_fkey FOREIGN KEY (consultant_id) REFERENCES public.consultants(id) ON DELETE CASCADE;


--
-- Name: pinned_slots pinned_slots_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_slots
    ADD CONSTRAINT pinned_slots_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_leader_consultant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_leader_consultant_id_fkey FOREIGN KEY (leader_consultant_id) REFERENCES public.consultants(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--



